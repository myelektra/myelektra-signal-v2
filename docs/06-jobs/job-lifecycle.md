# Job Lifecycle

## Purpose

Specify the state machine a job traverses, the meaning of each state, and the recovery behaviour that
makes a long daily run survivable.

## Scope

In scope: states, transitions, leasing, retry, and recovery. Out of scope: cron registration
([cron](cron.md)) and key semantics ([idempotency](idempotency.md)).

## Source of truth

- `S1` Strategic brief — the five states, the mandated job columns, and the required behaviours
  (lease, bounded batch, backoff, failure isolation, stale recovery).
- `D` Concrete parameters and transition rules proposed here.

## Requirements

### R-JL-1 States `S1`

| State | Meaning | Terminal |
| --- | --- | --- |
| `QUEUED` | Enqueued; runs when `available_at <= now()` | No |
| `RUNNING` | Leased by a worker identified in `locked_by` | No |
| `COMPLETED` | All units succeeded | Yes |
| `PARTIAL` | At least one unit succeeded and at least one failed | Yes |
| `FAILED` | Attempt failed; awaiting retry or admin action | No |

`PARTIAL` is a distinct terminal state and not a soft `FAILED` (BR-JB-10). The distinction is
operational: `PARTIAL` means the customer received something today and the admin queue should show the
specific failures; `FAILED` means the customer received nothing and the day is at risk.

### R-JL-2 Transitions `D`

```
QUEUED ──claim (lease taken)──────────▶ RUNNING
RUNNING ──all units ok────────────────▶ COMPLETED
RUNNING ──mixed outcome───────────────▶ PARTIAL
RUNNING ──unit failed, attempts left──▶ FAILED ──backoff──▶ QUEUED
RUNNING ──attempts exhausted──────────▶ FAILED (terminal in practice, admin-visible)
RUNNING ──lease expired───────────────▶ QUEUED        (stale recovery)
FAILED  ──manual admin retry──────────▶ QUEUED
```

Every transition writes `last_error` where an error occurred, and `completed_at` on terminal states.
A job that reaches a terminal state without `completed_at` is a bug and should be caught by a
constraint or a test.

### R-JL-3 Leasing `S1`

A lease is `locked_at` + `locked_by` with an expiry. Properties:

- Taken atomically with the claim (`for update skip locked`), so two workers cannot hold one job.
- Time-bounded, so a crashed worker does not strand the job forever.
- Identified, so an operator can tell which worker held it — the first question when investigating a
  stuck queue.
- Renewable for long units, if OD-JB-1's lease duration proves too short in practice.

### R-JL-4 Bounded batches `S1`

A claim is limited to a fixed number of units. Consequences:

- No invocation attempts unbounded work, so no invocation exceeds the function wall clock.
- Cost per invocation is bounded, which matters because units spend money on model and search calls.
- The queue drains across multiple invocations, which is what makes the run resumable.

### R-JL-5 Retry with backoff `S1`

`available_at = now() + min(base × 2^(attempt-1), cap)`. Exponential with a ceiling, so retries stay
inside the day and do not hammer a failing provider. Proposed base 1 minute, cap 60 minutes, max 5
attempts — **OD-JB-1, needs approval**.

### R-JL-6 Failure isolation `S1`

One unit's failure must not fail the batch. Each unit is processed in its own error boundary; a
failure is recorded against that unit and the batch continues. Without this, one organization with
malformed monitoring data stops the daily run for every customer — the difference between a support
ticket and an incident.

### R-JL-7 Stale recovery `S1`

The claim query includes jobs whose lease has expired. No separate sweeper is required, which removes
a component that could itself fail. A job killed mid-execution is re-claimed automatically and, thanks
to the idempotency key, does not duplicate work.

### R-JL-8 Run-level lifecycle `D`

A `research_runs` row aggregates its jobs. Run status is derived from job outcomes:

| Job outcomes | Run status |
| --- | --- |
| All `COMPLETED` | Completed |
| Any `PARTIAL` or `FAILED`, some succeeded | Partial |
| All `FAILED` | Failed |
| Some still queued/running | In progress |

`unique (organization_id, run_date)` prevents a double-fired cron from creating a second run
(BR-JB-09).

## Security considerations

- **Job rows are admin-readable only** ([rls R-RL-3](../02-database/rls.md#r-rl-3-policy-matrix-s1--d)).
  `last_error` may quote provider responses containing account identifiers or fragments of customer
  data.
- **The cron trigger carries no user identity**, so a job created by cron cannot act as a customer.
  Jobs carry the `organization_id` assigned by the dispatch that created them, never one read from an
  untrusted input.
- **Bounded batches are a cost control with security implications** — a triggered run against paid
  APIs is an invoice.
- **Backoff prevents provider hammering**, which can cause rate limiting that outlasts the original
  incident.
- **Stale recovery plus idempotency keys** mean a crash cannot produce duplicate Signals, which is a
  correctness property customers would notice immediately.

## Acceptance criteria

- [ ] Two concurrent workers never execute the same job id, asserted by a concurrency test.
- [ ] A worker killed mid-job leaves a lease that expires and the job is re-claimed automatically.
- [ ] Backoff grows exponentially and is capped, asserted at each attempt.
- [ ] A job at max attempts stops retrying with `last_error` populated and is admin-visible.
- [ ] One failing unit does not prevent sibling units from completing.
- [ ] A job reaching a terminal state always has `completed_at` set.
- [ ] Run status correctly reflects each combination of job outcomes.
- [ ] A double-fired dispatch creates exactly one run per organization per day.

## Related skills

- [`ddia-systems`](../SKILLS.md#ddia-systems) — leases and at-least-once with idempotent effects.
- [`release-it`](../SKILLS.md#release-it) — bulkheads, backoff, and failure isolation.
- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) — queue patterns.

## Open decisions

- **OD-JB-1** Lease duration, max attempts, backoff base and cap, batch size.
- **OD-JB-3** Whether a maxed-out `FAILED` job is retried on the next daily run or needs admin action.
- **OD-JL-1** Whether leases are renewable mid-execution.
- **OD-JL-2** Retention for completed job rows.
