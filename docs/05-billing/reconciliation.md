# Payment Reconciliation

## Purpose

Define how internal payment state is converged with provider truth, so that a missed, delayed, or
rejected webhook never becomes a permanently wrong ledger.

## Scope

In scope: the reconciliation job, its inputs and outputs, and its failure handling. Out of scope:
webhook handling ([paypal](paypal.md)) and job mechanics ([cron](../06-jobs/cron.md)).

## Source of truth

- `S1` Strategic brief — `payment-reconciliation` at `*/5 * * * *`, idempotent settlement, and the
  requirement that discrepancies surface rather than disappear.
- `S4` PayPal documentation for the transaction-listing API — must be verified (OD-PP-1).
- `D` Design decisions proposed here.

## Requirements

### R-RC-1 Purpose and cadence `S1`

Runs every 5 minutes. It is the **safety net, not the primary path**: the webhook is primary, and
reconciliation exists because webhooks are delivered at-least-once, can be delayed indefinitely, and
can be rejected by a transient failure on our side.

### R-RC-2 Inputs `D`

| Input | Why |
| --- | --- |
| `payments` rows in a non-terminal internal status older than a threshold | A checkout that never settled |
| `payment_events` with `processed_at is null` | A webhook received but not processed |
| `subscriptions` awaiting a renewal confirmation | A renewal the webhook missed |
| `organizations` in `PAYMENT_PROCESSING` beyond a threshold | A stuck access state |

The thresholds are `D` and need approval (OD-RC-1). They trade off provider API cost against how long
a customer sits in a wrong state.

### R-RC-3 Actions `D`

| Discrepancy | Action |
| --- | --- |
| Provider says paid, we say pending | Settle idempotently, update entitlement, audit |
| Provider says unpaid, we say paid | **Do not silently reverse.** Raise to the admin Action Required queue |
| Provider transaction unknown to us | Create the ledger row from the read-back, then settle |
| Webhook event unprocessed | Process it through the normal path |
| Access state stuck | Advance or raise, depending on provider truth |

The second row is the important one. Automatically reversing a customer's access because a provider
read disagreed is how a paying customer gets locked out during a provider outage. Reconciliation
converges toward *settling*, and escalates anything that would *remove* access.

### R-RC-4 Idempotency `S1`

Reconciliation converges toward provider state, so running it twice is harmless by construction. It
also shares the settlement path with the webhook, which means both are protected by the same
constraints: `unique (provider, provider_transaction_id)` on `payments` and
`unique (provider, provider_event_id)` on `payment_events`.

This convergence is deliberate. A reconciliation job that used a *different* settlement path from the
webhook would have two idempotency guarantees to get right instead of one.

### R-RC-5 Failure handling `S1` + `D`

| Failure | Behaviour |
| --- | --- |
| Provider API unavailable | Retry with backoff; do not mark the discrepancy resolved |
| A single row fails | Isolate it; continue with the rest ([cron R-CR-5](../06-jobs/cron.md#r-cr-5-required-behaviours-s1)) |
| Repeated failure on one row | Raise to admin Action Required with `last_error` |
| Reconciliation itself fails | Visible in admin System health; unprocessed-event age alert fires |

A reconciliation failure that is invisible is worse than no reconciliation, because it creates
confidence that discrepancies are being handled.

### R-RC-6 Observability `D`

| Signal | Alert when |
| --- | --- |
| Unprocessed `payment_events` age | Any older than 15 minutes |
| `PAYMENT_PROCESSING` organizations age | Any older than 30 minutes |
| Reconciliation job failures | Any two consecutive |
| Discrepancies raised to admin | Any — these are individually interesting |

## Security considerations

- **Reconciliation must never take a shortcut around verification.** It uses the same settlement path
  as the webhook, so a read-back that has not been confirmed by the provider cannot grant entitlement.
- **Escalate rather than auto-reverse** (R-RC-3). Automated access removal driven by an external read
  is a denial-of-service vector if the provider's response can be influenced or if the provider is
  briefly wrong.
- **Reconciliation runs with the service role** and therefore has no RLS protection. Its queries must
  be scoped explicitly, and it must never take a tenant scope from an untrusted source.
- **Every settlement it performs is audited**, and the audit entry distinguishes
  reconciled-from-webhook from reconciled-from-read-back. That distinction is the first thing an
  investigator asks about.
- **Bounded scope per run** prevents a reconciliation storm against the provider API after an outage,
  which would otherwise trade one incident for a rate-limit incident.

## Acceptance criteria

- [ ] A deliberately dropped webhook is resolved by reconciliation within one cron cycle.
- [ ] Running reconciliation twice over the same discrepancy produces exactly one settlement.
- [ ] A provider-side "unpaid" for an internally "paid" row raises to the admin queue and does not
      remove access automatically.
- [ ] One failing row does not prevent the rest from being processed.
- [ ] Every reconciliation-driven settlement writes an audit entry marked as reconciled.
- [ ] Unprocessed-event age is visible in admin System health.
- [ ] A provider outage causes retries, not false resolutions.

## Related skills

- [`ddia-systems`](../SKILLS.md#ddia-systems) — converging with an external source of truth.
- [`release-it`](../SKILLS.md#release-it) — bulkheads and escalation over automation.
- [`system-design`](../SKILLS.md#system-design) — one settlement path, two triggers.

## Open decisions

- **OD-RC-1** The staleness thresholds in R-RC-2.
- **OD-RC-2** Whether reconciliation should also detect provider-side refunds we never received a
  webhook for. Increases API cost; catches a real gap.
- **OD-RC-3** Whether an escalated discrepancy blocks further processing for that organization or
  only for that row.
