# Currency and Cost Policy

## Purpose

Two policies that are easy to leave implicit and expensive to discover late: the currency the product
transacts in, and the ceiling on what the product may spend to produce a Signal. The first is settled
by the brief. The second is defined here as a **mechanism**, with its numbers explicitly withheld.

## Scope

In scope: currency rules, where currency is enforced, and the cost-control mechanism and its
observability. Out of scope: pricing per plan ([schema](../02-database/schema.md#r-db-3-core-entities-d)),
entitlement quotas ([entitlements](entitlements.md)), and the payment flow ([paypal](paypal.md)).

## Source of truth

- `S1` Strategic brief — "USD", "Monthly subscription", "Browser tidak boleh mengirim … currency
  override", bounded batches, and the requirement that the daily process be resumable.
- `S2`/`S3` Legacy billing and pipeline configuration — **not available**. Cost ceilings that the
  legacy system may have used are **unknown** and are not assumed.
- `D` Mechanism design proposed here.
- `X` All numeric ceilings. See R-CO-5.

## Requirements

### R-CU-1 Single currency `S1`

**USD is the only currency.** There is no multi-currency support, no conversion, and no
currency selection by the customer.

| Rule | Enforcement |
| --- | --- |
| `packages.currency` is always `USD` | `check (currency = 'USD')` — the constraint, not a default |
| `payments.currency` is always `USD` | `check (currency = 'USD')` |
| The browser cannot send a currency | Forbidden-field rejection ([paypal R-PP-3](paypal.md#r-pp-3-what-the-browser-may-not-supply-s1)) |
| PayPal orders are created in USD | Server-side creation only; the client supplies a plan key |
| Amounts are integer cents | `amount_cents integer check (amount_cents > 0)` — no float money anywhere |

Enforcing this with a `check` constraint rather than a code default matters: a constraint cannot be
bypassed by a new code path that forgets the default.

### R-CU-2 Why no conversion layer `D`

No FX table, no rate cache, no display-currency setting. Reasons:

- **Money is stored and charged in one unit.** A conversion layer introduces a second source of truth
  for an amount, and a disagreement between them is a billing dispute.
- **PayPal settles in USD.** Any displayed non-USD figure would be an estimate that does not match
  the charge.
- **A conversion rate is a time-varying value in a ledger.** Recording "what the customer was shown"
  versus "what was charged" creates reconciliation work with no product benefit at this stage.

If display in a local currency is ever required, it becomes a labelled estimate clearly separated
from the charged amount — **OD-CU-1**, not decided here.

### R-CU-3 Rounding `D`

Prices are exact USD amounts in cents (1900, 4900, 9900). No fractional cents exist, so no rounding
rule is needed at the payment boundary. Where a derived figure is displayed (for example, a per-day
cost in admin Economics), it is labelled as derived and is never used as a charged amount.

### R-CU-4 Provenance of the amount `S1`

The amount charged is read from `packages` at order-creation time. It is never accepted from the
client, never carried across a session, and never reconciled against a client-supplied value. A price
change therefore applies to orders created after the change, and historical `payments` rows keep the
amount actually charged.

---

### R-CO-1 Why cost policy belongs in the architecture `S1`

Producing a Signal spends money on external providers — model calls, search calls, and any
verification fetches. The daily run is triggered by cron across every entitled organization, so an
unbounded per-organization cost is an unbounded invoice that arrives without a human deciding
anything. Cost control is therefore a **reliability and security control**, not a finance
afterthought: [threat T-16](../07-security/threat-model.md#r-tm-2-threats-and-controls) treats cost
amplification as an attack.

### R-CO-2 The mechanism `D`

| Control | Requirement |
| --- | --- |
| **Attribution** | Every paid provider call is attributable to an `organization_id` and a `signal_jobs.id`. An unattributable call is a defect. |
| **Per-job budget** | A job has a token/call budget. Exceeding it fails that job, not the run. |
| **Per-run ceiling** | A daily run has a ceiling. Exceeding it stops dispatching further jobs and marks the run `PARTIAL` with the reason. |
| **Per-organization ceiling** | An organization's daily spend is capped, so one large account cannot consume the run. |
| **Cheap-before-expensive** | Cheap filtering precedes AI validation ([validation R-VA-1](../04-signals/validation.md#r-va-1-stage-order-s1)) so model spend is limited to survivors. |
| **Bounded batches** | Claims are limited ([cron R-CR-5](../06-jobs/cron.md#r-cr-5-required-behaviours-s1)), so no invocation does unbounded work. |
| **Stored, not hardcoded** | Ceilings live in configuration, so changing one is a data change with an audit trail, not a deploy. |
| **Observed** | Spend is surfaced in admin **Economics** and **System health** ([cron R-CR-8](../06-jobs/cron.md#r-cr-8-observability-d)). |

### R-CO-3 Failure behaviour on ceiling breach `D`

| Breach | Behaviour |
| --- | --- |
| Per-job budget | That job → `FAILED` with `last_error` naming the budget. Sibling jobs unaffected. |
| Per-organization ceiling | That organization's remaining jobs stay `QUEUED` for the next run. Already-published Signals are untouched. |
| Per-run ceiling | Dispatch stops; the run → `PARTIAL`; the reason is recorded and surfaced in Action Required. |

A ceiling breach is never silent. A run that quietly processed half the customers looks identical to
a run that found nothing, which is how a cost control becomes a support incident.

### R-CO-4 Cost per customer must be knowable `D`

Admin **Economics** must be able to answer, per organization and per day: Signals published, paid
provider calls made, and spend incurred. Without this, a plan's price cannot be evaluated against
what it costs to serve — and with three plans at $19/$49/$99, an unpriced cost structure is how a plan
becomes loss-making without anyone noticing.

### R-CO-5 The numbers are not assumed `S1`

**No numeric ceiling is defined in this document.**

| Value | Status |
| --- | --- |
| Per-job token budget | `X` — **OD-CO-2** |
| Per-organization daily ceiling | `X` — **OD-CO-2** |
| Per-run ceiling | `X` — **OD-CO-2** |
| Per-candidate call limit | `X` — **OD-CO-2** |
| Provider unit costs | `X` — **OD-CO-3**, verify against provider pricing |

The brief mandates bounded batches but supplies no figures, and the legacy configuration is
unavailable. Choosing a number here would produce a ceiling that looks authoritative the moment it
appears in code, and would silently decide how many Signals a customer receives. **The mechanism is
specified; the policy values are blocked.**

This is the same discipline applied to package quotas ([entitlements R-EN-6](entitlements.md#r-en-6-quota-behaviour-x)):
build the enforcement, withhold the number.

### R-CO-6 Relationship to quotas `D`

Cost ceilings and plan quotas are **different controls** and must not be conflated:

| | Cost ceiling | Plan quota |
| --- | --- | --- |
| Protects | The operator's margin | The product's tiering |
| Visible to customer | No | Yes |
| Source | This document | `packages.limits` — blocked, **B-2** |
| On breach | Job/run degrades, admin alerted | Customer sees a typed denial |

A cost ceiling that silently reduced a customer's Signal count would be an invisible entitlement
change. The two must be enforced separately, for exactly that reason.

## Security considerations

- **Cost amplification is an attack** (T-16). A user who can trigger runs, or a monitoring profile
  that expands candidate volume, is a spend vector. Bounded batches, per-organization ceilings, and
  cron-only dispatch are the controls.
- **Currency constraints are integrity controls.** `check (currency = 'USD')` makes a
  currency-override attack unrepresentable at the storage layer, independent of any code review.
- **Integer cents, never floats.** Float money accumulates rounding error that eventually becomes a
  reconciliation failure nobody can explain.
- **Attribution is what makes an anomaly findable.** An unattributed provider call cannot be
  investigated, so "spend went up" has no answer.
- **Ceilings in configuration, not code**, means an operator can respond to a cost incident without a
  deploy — and the change is audited.

## Acceptance criteria

- [ ] `packages` and `payments` both carry `check (currency = 'USD')`; a non-USD insert is rejected.
- [ ] A checkout request containing `currency` is rejected with `400` and audited.
- [ ] No float type is used for any monetary value in the schema.
- [ ] Every paid provider call records its `organization_id` and `job_id`.
- [ ] Exceeding a per-job budget fails that job only; siblings complete.
- [ ] Exceeding the per-run ceiling marks the run `PARTIAL` with a recorded reason and surfaces it in
      Action Required.
- [ ] Admin Economics can report spend per organization per day.
- [ ] All numeric ceilings are absent from code and configuration until OD-CO-2 is resolved —
      verified by review, since a guessed number would look correct.

## Related skills

- [`release-it`](../SKILLS.md#release-it) — bulkheads and circuit breakers applied to spend.
- [`system-design`](../SKILLS.md#system-design) — cost as a first-class architectural constraint.
- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) — check
  constraints and integer money.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — build the mechanism, withhold the
  number until it is decided.

## Open decisions

- **OD-CU-1** Whether to ever display a non-USD estimate, and how it would be labelled.
- **OD-CO-2** The numeric ceilings: per-job token budget, per-organization daily ceiling, per-run
  ceiling, per-candidate call limit. **Blocks a safe production daily run.**
- **OD-CO-3** Provider unit costs, verified against current provider pricing. Required before
  Economics can show margin rather than call counts.
- **OD-CO-4** Whether a ceiling breach should page an operator or only queue an Action Required item.
- **OD-CO-5** Whether cost telemetry is retained per call or aggregated per job. Affects both
  debuggability and storage.
