# Idempotency

## Purpose

Specify how the system achieves at-most-once *effects* over at-least-once *delivery*, for both jobs
and payments — the two places where a duplicate is expensive.

## Scope

In scope: idempotency keys, their construction, and the guarantees they provide. Out of scope: job
states ([job-lifecycle](job-lifecycle.md)) and webhook verification
([paypal](../05-billing/paypal.md)).

## Source of truth

- `S1` Strategic brief — "every job must have an idempotency key", "payment idempotency", "webhook
  replay protection", "idempotent settlement", "duplicate run prevention".
- `D` Key construction proposed here.

## Requirements

### R-ID-1 The problem `S1`

Everything that triggers work here is at-least-once:

| Trigger | Why it can duplicate |
| --- | --- |
| pg_cron | Can double-fire; a run can be re-invoked after a timeout |
| Webhooks | PayPal retries until acknowledged; network can duplicate |
| Retried jobs | A crash after the effect but before the state write |
| Client retries | A user double-clicking checkout; a browser resending |

The system must therefore make duplicate *delivery* harmless rather than trying to prevent it.
Preventing delivery is not possible; making effects idempotent is.

### R-ID-2 Construction rule `D`

An idempotency key must be a deterministic function of **what** is being done, not of **when** or
**which attempt**:

| Good | Bad |
| --- | --- |
| `(organization_id, run_date, job_type, unit_id)` | `(timestamp, random)` |
| `(provider, provider_event_id)` | `(received_at)` |
| `(provider, provider_transaction_id)` | A client-generated uuid per request |

A key containing a timestamp or a random value is not an idempotency key; it is a unique id that
guarantees the opposite of what is wanted.

### R-ID-3 Job keys `S1` + `D`

```
signal_jobs.idempotency_key = <organization_id>:<run_date>:<job_type>:<unit_id>
unique (idempotency_key)
```

Effect: re-dispatching the same day for the same organization cannot enqueue a second copy of the
same unit. Combined with `unique (organization_id, run_date)` on `research_runs`, a double-fired cron
produces exactly one run and exactly one job set.

### R-ID-4 Payment keys `S1`

```
payment_events:  unique (provider, provider_event_id)      ← replay protection
payments:        unique (provider, provider_transaction_id) ← settlement idempotency
                 unique (provider, provider_order_id)
                 unique (provider, provider_subscription_id)
                 unique (internal_order_id)
```

All are **provider-scoped** (INV-9). There is no global `transaction_id` column (INV-10), because a
single global identifier namespace across providers is exactly how collisions and cross-provider
confusion enter a payment system.

### R-ID-5 Insert-then-act, never check-then-insert `D`

The settlement sequence is:

```
1. insert into payment_events (provider, provider_event_id, …)
     └─ unique violation → already seen → acknowledge and stop
2. insert into payments (…)
     └─ unique violation → already settled → stop
3. update organizations (entitlement, access state)
4. insert into audit_logs
   — steps 2–4 in one transaction
```

A `check-then-insert` implementation has a window between the check and the insert that a concurrent
duplicate delivery will eventually find. `insert-then-act` closes it with a constraint, which holds
under any concurrency the database supports.

This is the single most important implementation rule in the billing domain.

### R-ID-6 Acknowledgement semantics `D`

A duplicate webhook is acknowledged successfully, not rejected. Returning an error for a replay makes
the provider keep retrying, which turns a handled case into a persistent one. The correct response to
"already processed" is `200` with no state change.

### R-ID-7 What idempotency does not cover `D`

| Not covered | Why |
| --- | --- |
| Non-idempotent external effects | Sending a duplicate email requires a separate guard |
| Partially completed units | Idempotency prevents re-*starting*, not partial re-*doing*; units must be individually safe |
| Client-side double submission | Handled by disabling the control during mutation pending, plus the server key |

Delivery-side idempotency deserves a note: publishing a Signal twice is prevented by deduplication
and by the uniqueness constraints, but sending a notification twice is a separate effect with its own
key.

## Security considerations

- **Idempotency is a replay defence.** The unique constraint on `provider_event_id` is what makes a
  replayed webhook a no-op; without it, replaying a captured "payment successful" webhook is free
  service.
- **Database constraints, not application checks** (R-ID-5). An application-level check is a race
  window; a constraint is a guarantee.
- **Provider scoping** prevents a collision between provider namespaces from being interpreted as a
  duplicate — which would silently drop a legitimate payment.
- **Acknowledging duplicates** (R-ID-6) avoids an attacker using retry storms to keep a webhook
  endpoint busy or to provoke error-path behaviour.
- **Audit entries distinguish first processing from replay**, so an investigator can tell a retry from
  an attack.

## Acceptance criteria

- [ ] The same job key inserted twice raises a uniqueness violation.
- [ ] A double-fired dispatch produces one run and one job set per organization.
- [ ] The same webhook delivered twice sequentially produces one ledger row and one entitlement change.
- [ ] The same webhook delivered twice **concurrently** produces one of each.
- [ ] A replayed webhook is acknowledged with `200` and causes no state change.
- [ ] No idempotency key contains a timestamp or a random component.
- [ ] No column named `transaction_id` without a `provider_` prefix exists in the schema.
- [ ] Duplicate delivery produces an audit entry identifiable as a replay.

## Related skills

- [`ddia-systems`](../SKILLS.md#ddia-systems) — exactly-once effects over at-least-once delivery.
- [`system-design`](../SKILLS.md#system-design) — idempotent API design.
- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) — partial unique
  indexes on nullable provider columns.

## Open decisions

- **OD-ID-1** Whether `unit_id` in the job key is the monitored account, the candidate batch, or
  something else. Depends on the pipeline's unit definition, which depends on OD-BR-2.
- **OD-ID-2** A separate idempotency key scheme for delivery attempts and notifications.
- **OD-ID-3** Whether client-initiated mutations (for example, creating an opportunity) carry a
  client-generated idempotency key. Recommended, but not in the brief.
