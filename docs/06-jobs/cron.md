# Cron and Scheduling

## Purpose

Define how scheduled work is triggered, why the scheduler never performs work, and how the job
lifecycle makes a long daily run resumable after any failure.

## Scope

In scope: cron registration, the dispatcher/worker split, job claiming, leases, retries, and stale
recovery. Out of scope: the signal pipeline's internal stages ([signal-model](../04-signals/signal-model.md))
and idempotency-key semantics in detail ([idempotency](idempotency.md)).

## Source of truth

- `S1` Strategic brief — Supabase Cron/pg_cron as the scheduler, the two initial schedules, "cron is
  only a dispatcher", the five job states, the mandated job columns, and the required behaviours
  (idempotency, lease, bounded batch, backoff, failure isolation, stale recovery, duplicate-run
  prevention).
- `S4` Supabase documentation for `pg_cron` and `pg_net` — must be verified, including whether
  `pg_net` is enabled on the target project.
- `D` Concrete parameters proposed here.

## Requirements

### R-CR-1 Registered schedules `S1`

| Job | Schedule | UTC | Role |
| --- | --- | --- | --- |
| `signal-daily-dispatch` | `0 3 * * *` | 03:00 daily | Create or resume `research_runs`, enqueue `signal_jobs` |
| `payment-reconciliation` | `*/5 * * * *` | Every 5 minutes | Converge `payments` with provider truth |

Both run in UTC. Local-time schedules are prohibited: a schedule that shifts with daylight saving
produces a run at a different wall-clock time twice a year and a duplicated or skipped run at the
transition.

### R-CR-2 Cron is a dispatcher, never a worker `S1`

The cron callback does exactly one thing: invoke the dispatcher. It contains no business logic, no
provider call, and no loop over tenants.

```sql
select cron.schedule(
  'signal-daily-dispatch',
  '0 3 * * *',
  $$ select net.http_post(
       url     := 'https://<project-ref>.supabase.co/functions/v1/signal-dispatch',
       headers := '{"Authorization": "Bearer <service-invocation-secret>"}'::jsonb,
       body    := '{"trigger": "cron"}'::jsonb,
       timeout_milliseconds := 5000
     ) $$
);
```

Why this split matters, in the brief's own terms: the daily process must not depend on a browser and
must not be "one long function that cannot be resumed". A cron callback that did the work would be
killed by the function timeout with no way to continue, and the whole day's Signals would be lost.

`net.http_post` returns immediately; the dispatcher then has the full function budget to enqueue
work and exit. Work is executed by separately-invoked workers, each bounded.

### R-CR-3 Job lifecycle `S1`

```
QUEUED ──claim──▶ RUNNING ──┬──▶ COMPLETED
                            ├──▶ PARTIAL      (some units failed, some succeeded)
                            └──▶ FAILED ──backoff──▶ QUEUED (attempt_count + 1)
RUNNING ──lease expiry──▶ QUEUED              (stale recovery)
```

| State | Meaning | Terminal |
| --- | --- | --- |
| `QUEUED` | Enqueued, `available_at` reached or pending | No |
| `RUNNING` | Leased by a worker | No |
| `COMPLETED` | All units succeeded | Yes |
| `PARTIAL` | At least one unit succeeded and at least one failed | Yes |
| `FAILED` | Attempt exhausted or unrecoverable; awaiting retry or admin action | No |

`PARTIAL` is a distinct terminal state, not a soft `FAILED` (BR-JB-10). It matters operationally:
`PARTIAL` means the customer received something today and the admin queue should show the specific
failures, whereas `FAILED` means the customer received nothing.

### R-CR-4 Claiming `S1` + `D`

Concurrent workers must not both take the same job. Claiming uses a lease taken atomically:

```sql
update signal_jobs j
set status      = 'RUNNING',
    locked_at   = now(),
    locked_by   = p_worker_id,
    attempt_count = attempt_count + 1
from (
  select id from signal_jobs
  where status in ('QUEUED','FAILED')
    and available_at <= now()
    and (locked_at is null or locked_at < now() - interval '<lease>')
  order by available_at, id
  limit p_batch_size
  for update skip locked
) c
where j.id = c.id
returning j.*;
```

`for update skip locked` is the mechanism that makes horizontal scaling safe: a second worker does
not block behind the first, it takes the next job.

### R-CR-5 Required behaviours `S1`

| Behaviour | Mechanism | Verification |
| --- | --- | --- |
| Idempotency key | `signal_jobs.idempotency_key unique` | Inserting a duplicate raises |
| Lease / lock | `locked_at`, `locked_by`, expiry predicate | Two workers cannot hold one job |
| Bounded batch | `limit p_batch_size` on the claim query | A run never processes an unbounded tenant count |
| Retry with backoff | `available_at = now() + backoff(attempt_count)` | Backoff grows and is capped |
| Failure isolation | Per-unit try/catch; a failed unit does not abort the batch | One bad org does not fail the day |
| Stale job recovery | Lease-expiry predicate in the claim query | A killed worker's job is re-claimable |
| Duplicate run prevention | `unique (organization_id, run_date)` on `research_runs` | A double-fired cron creates one run |

Failure isolation deserves emphasis: without it, one organization with malformed monitoring data
takes down the daily run for every customer. That is the difference between a support ticket and an
incident.

### R-CR-6 Parameters `D`

These are proposals, not inherited values. The brief mandates the mechanisms but not the numbers,
and the legacy configuration is unavailable.

| Parameter | Proposed | Rationale |
| --- | --- | --- |
| Lease duration | 10 minutes | Long enough for one bounded unit; short enough that recovery is prompt |
| Max attempts | 5 | Enough for transient provider failures, few enough to fail visibly |
| Backoff | `min(base × 2^(attempt-1), cap)`, base 1 min, cap 60 min | Exponential with a ceiling so retries stay inside the day |
| Batch size | 25 organizations per dispatch invocation | Keeps a single invocation inside the function budget |
| Stale-run threshold | `available_at` older than 24h → admin queue | A run that never started is a visible failure |

**These require approval before implementation** (OD-JB-1). They are marked `D` precisely so that
nobody later assumes they were inherited from a system that had already tuned them.

### R-CR-7 Worker invocation model `D`

The dispatcher enqueues and returns. Workers are invoked by a separate mechanism so that no single
invocation must finish the day's work:

| Option | Trade-off |
| --- | --- |
| Dispatcher self-chains (function invokes the next worker before returning) | Simple; risks exceeding the function wall-clock budget |
| A frequent `signal-worker` cron (e.g. every minute) draining the queue | Robust and resumable; adds a third registered schedule |
| Queue-driven invocation | Cleanest; depends on platform capability not yet confirmed |

Recommendation: the second, because it satisfies "must not be one long function that cannot be
continued" most directly. This adds a schedule beyond the two the brief lists, so it needs approval
(OD-JB-2).

### R-CR-8 Observability `D`

| Signal | Source | Alert when |
| --- | --- | --- |
| Run started / completed | `research_runs` | No run row exists for today by 04:00 UTC |
| Job state distribution | `signal_jobs` | `FAILED` count above threshold |
| Stale leases | `locked_at` age | Any lease older than 3× lease duration |
| Attempt saturation | `attempt_count >= max` | Any job at max attempts |
| Reconciliation lag | `payment_events.processed_at is null` age | Any unprocessed event older than 15 minutes |
| Queue depth | `QUEUED` count | Growing across consecutive cycles |

Every one of these surfaces in the admin **System health** and **Action Required** views. A failure
mode that is not visible in the admin UI is a failure mode that will be discovered by a customer.

## Security considerations

- **The cron invocation carries no user identity.** It must therefore grant none. A cron-triggered
  function cannot act "as a customer" and must never accept a tenant scope from its trigger payload.
- **The service invocation secret** used in `net.http_post` is a credential. It lives in Vault, is
  never logged, and a leak would allow anyone to trigger a full daily run — a cost-amplification
  attack. It is rotated on the same schedule as other secrets ([secrets](../07-security/secrets.md)).
- **Bounded batches are a cost control as well as a reliability control.** An unbounded run against a
  paid search or model API is an unbounded invoice.
- **Retry backoff prevents provider hammering.** Tight retries against a failing provider can
  trigger rate limiting or account-level throttling that outlasts the incident.
- **Job rows are tenant-owned** (`organization_id`, INV-1) and are not readable by `CUSTOMER`
  ([rls](../02-database/rls.md#r-rl-3-policy-matrix-s1--d)) — they expose pipeline internals and
  error text that may contain fragments of provider responses.

## Acceptance criteria

- [ ] Both registered schedules exist and are listed by `select * from cron.job`.
- [ ] The cron callback contains no business logic — verified by review of the migration text.
- [ ] Two concurrent workers processing the same queue never both execute the same job id.
- [ ] A worker killed mid-job leaves a lease that expires, and the job is re-claimed automatically.
- [ ] A job failing repeatedly backs off, and stops at max attempts with `last_error` populated.
- [ ] One failing organization does not prevent others in the same batch from completing.
- [ ] Firing the dispatch cron twice on the same day creates exactly one `research_runs` row per org.
- [ ] A job left `RUNNING` with an expired lease is recovered without manual intervention.
- [ ] No `QUEUED` job remains unprocessed past its expected window without appearing in the admin
      Action Required queue.

## Related skills

- [`ddia-systems`](../SKILLS.md#ddia-systems) — leases, at-least-once delivery, and exactly-once effects.
- [`release-it`](../SKILLS.md#release-it) — backoff, bulkheads, and failure isolation.
- [`supabase`](../SKILLS.md#supabase) — `pg_cron` / `pg_net` capability and limits.
- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) — `skip locked`
  queue patterns and index support for the claim query.

## Open decisions

- **OD-JB-1** Approve the concrete parameters in R-CR-6. Tagged `D`.
- **OD-JB-2** Approve adding a `signal-worker` drain schedule beyond the two listed in the brief
  (R-CR-7). Tagged `D`.
- **OD-JB-3** Whether a `FAILED` job at max attempts is retried on the next daily run or requires
  manual admin action. Tagged `X` (BR-JB-12).
- **OD-JB-4** Whether `pg_net` is enabled on the target Supabase project; if not, the cron
  invocation mechanism must change. Tagged `X` — verify against the project.
- **OD-JB-5** Alerting channel for the observability signals in R-CR-8. Tagged `D`.
