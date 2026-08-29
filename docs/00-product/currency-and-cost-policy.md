# Currency and Cost Policy

## Purpose

One currency, everywhere, with no conversion anywhere. This document is the normative statement of
that rule for every money-bearing surface in the system — prices, payments, subscriptions, provider
transactions, provider costs, COGS, and margin — and the explicit list of constructs that must never
exist.

## Scope

In scope: the single-currency rule, every surface it applies to, the prohibited constructs, and the
cost-control mechanism. Out of scope: per-plan prices ([pricing](../05-billing/pricing.md)),
entitlement quotas ([entitlements](../05-billing/entitlements.md)), and the payment flow
([paypal](../05-billing/paypal.md)).

## Source of truth

- `S1` Strategic brief — "USD", "Monthly subscription", the prohibition on client-supplied currency
  override, bounded batches, and the owner's currency directive (2026-08-29): all prices, payments,
  subscriptions, PayPal transactions, OpenAI token costs, search provider costs, email/provider
  costs, COGS, and margin are in USD; no IDR, no FX, no exchange rate, no conversion of any kind.
- `S2`/`S3` Legacy billing configuration — **not available**. Any IDR or FX handling the legacy
  system may have had is **not carried over and not assumed to exist**.
- `D` Mechanism design proposed here.
- `X` All numeric cost ceilings. See R-CO-5.

## Requirements

### R-CU-1 Single currency, every surface `S1`

**USD is the only currency in the system.** There is no second currency, no conversion, and no
currency selection by anyone — customer, admin, or code.

| Surface | Currency | Enforcement |
| --- | --- | --- |
| Plan prices | USD | `packages.currency` with `check (currency = 'USD')` |
| Customer payments | USD | `payments.currency` with `check (currency = 'USD')` |
| Subscriptions | USD | Inherited from `packages`; no subscription-level currency column exists |
| PayPal orders, captures, subscriptions, refunds, disputes | USD | Created server-side in USD only; the provider account is USD |
| OpenAI token cost | USD | Recorded in `cost_entries.amount_usd` |
| Search provider cost | USD | Same |
| Email / delivery provider cost | USD | Same |
| Any other provider cost | USD | Same — the column permits no other value |
| COGS | USD | Derived only from USD cost entries |
| Margin | USD | `revenue(USD) − COGS(USD)`; both operands are USD by construction |

Every one of these is enforced by a **`check` constraint**, not by a code default. A default can be
forgotten by a new code path; a constraint cannot be satisfied by a wrong value.

Amounts are stored in columns named **`amount_usd`** (or `price_usd` for the catalog) using an exact
decimal type, `numeric(p,s)`. **Floating-point types are prohibited** — `float`, `real`, and `double
precision` cannot represent `19.99` exactly in binary, and the error accumulates.

An earlier revision of this document said "no fractional numeric". That was wrong: it would have
prohibited the exact type `amount_usd` requires. The rule is **no floating point**, not "no decimals".

Scale is chosen per surface: `numeric(12,2)` for prices and payments, where a cent is the smallest
real unit; `numeric(14,6)` for `cost_entries`, because a single model or search call can cost a
fraction of a cent and would otherwise round to `0.00` and silently understate COGS.

### R-CU-2 Prohibited constructs `S1`

None of the following may exist in the schema, the code, the configuration, or the documentation as
anything other than a prohibition:

| Prohibited | Note |
| --- | --- |
| `IDR` | No Indonesian rupiah anywhere — no column, no constant, no display path |
| `amount_idr` | No dual-currency amount column |
| `fx_rate` | No rate column |
| `exchange_rate` | No rate column |
| `USD_TO_IDR` | No rate constant |
| `MAYAR` / Mayar | Excluded provider. See [legacy-exclusion-list](legacy-exclusion-list.md) |
| `MIDTRANS` / Midtrans | Excluded provider. See [legacy-exclusion-list](legacy-exclusion-list.md) |
| Currency conversion | No conversion function, service, module, or helper |
| Country-based currency conversion | Currency is never derived from country, locale, IP, or browser language |
| FX table / rate cache | No storage of rates, historical or current |
| Display-currency setting | No per-user or per-organization currency preference |
| `Convex` | Excluded platform. See [legacy-exclusion-list](legacy-exclusion-list.md) |

**Verified state of this repository.** A scan for `IDR`, `amount_idr`, `fx_rate`, `exchange_rate`,
`USD_TO_IDR`, and `rupiah` returns **26 hits, every one of them a statement of this prohibition** —
concentrated in this file and in [legacy-exclusion-list](legacy-exclusion-list.md). The meaningful
invariant is narrower and is what the CI gate enforces:

- **no occurrence outside exclusion documentation**;
- **no occurrence as a defined schema field, constant, code identifier, or configuration value**;
- **no occurrence in any non-markdown file** — the repository currently contains none.

Stating this precisely matters: "zero hits" was true before the exclusion list was written and is
false now, and a gate written against the false version would fail on its own documentation.

### R-CU-3 Currency is never derived from context `S1`

Currency is a constant, not a computation. Specifically, it is **never** derived from:

- the customer's country, region, or address
- the browser's `Accept-Language` header or locale setting
- the request's IP address or geolocation
- the PayPal account's country
- any user or admin preference

There is one value and it is `USD`. A system that infers currency from context will eventually charge
someone in a currency nobody approved, and the resulting ledger will not reconcile.

### R-CU-4 Why there is no conversion layer `D`

- **One unit of account.** A conversion layer creates a second source of truth for every amount, and
  a disagreement between the two is a billing dispute.
- **PayPal settles in USD.** Any displayed non-USD figure would be an estimate that does not match
  the charge on the customer's statement.
- **Rates are time-varying values in an immutable ledger.** Recording "what was shown" versus "what
  was charged" creates permanent reconciliation work for no product benefit.
- **COGS and margin stay meaningful.** Mixing currencies in a margin calculation produces a number
  that cannot be interpreted. With one currency, `margin = revenue − COGS` needs no qualification.

If the business ever needs a local-currency *display*, it becomes a clearly labelled estimate, shown
alongside and never instead of the USD amount, with the conversion performed outside the system of
record. That is **OD-CU-1** and it is not decided here.

### R-CU-5 Cost accounting in USD `S1` + `D`

Every paid provider call is recorded as a cost entry in USD cents:

| Field | Rule |
| --- | --- |
| `provider` | `OPENAI`, `SEARCH`, `EMAIL`, or another named provider |
| `amount_usd` | `numeric(14,6)`, USD, `check (amount_usd >= 0)` |
| `currency` | `check (currency = 'USD')` — present so the constraint is explicit, not implied |
| `organization_id` | Attribution to the tenant that caused the spend |
| `job_id` | Attribution to the unit of work |
| `units` | What was consumed (tokens, queries, messages) — for unit-cost analysis |

Rules:

- **Unit prices are USD.** A token price, a query price, and a message price are all USD figures.
  Where a provider publishes pricing in another currency, the USD figure is recorded as the
  authoritative unit price and the source is noted. No rate is stored, because no rate is used.
- **COGS is the sum of USD cost entries** attributable to serving a tenant or a period. It is derived,
  never entered by hand.
- **Margin is USD revenue minus USD COGS.** Both operands are USD by construction, so margin needs no
  currency qualification anywhere it is displayed.
- **Cost entries are append-only**, like `audit_logs`. An editable cost history makes margin
  unauditable.

### R-CO-1 Why cost policy belongs in the architecture `S1`

Producing a Signal spends money: model calls, search calls, verification fetches, delivery. The daily
run is triggered by cron across every entitled organization, so an unbounded per-organization cost is
an unbounded invoice that arrives without a human deciding anything. Cost control is therefore a
reliability and security control, not a finance afterthought:
[threat T-16](../07-security/threat-model.md#r-tm-2-threats-and-controls) treats cost amplification
as an attack.

### R-CO-2 The mechanism `D`

| Control | Requirement |
| --- | --- |
| **Attribution** | Every paid provider call records its `organization_id` and `job_id`. An unattributable call is a defect. |
| **Per-job budget** | A job has a USD cost budget and a token/call budget. Exceeding either fails that job, not the run. |
| **Per-organization ceiling** | An organization's daily USD spend is capped, so one large account cannot consume the run. |
| **Per-run ceiling** | A daily run has a USD ceiling. Exceeding it stops dispatch and marks the run `PARTIAL` with the reason. |
| **Cheap-before-expensive** | Cheap filtering precedes AI validation ([validation R-VA-1](../04-signals/validation.md#r-va-1-stage-order-s1)), so model spend is limited to survivors. |
| **Bounded batches** | Claims are limited ([cron R-CR-5](../06-jobs/cron.md#r-cr-5-required-behaviours-s1)). |
| **Stored, not hardcoded** | Ceilings and unit prices live in configuration, so a change is an audited data change, not a deploy. |
| **Observed** | Spend and margin are surfaced in admin **Economics** and **System health**. |

All ceilings and unit prices are **USD**. A ceiling expressed in any other unit would reintroduce the
conversion this document exists to prevent.

### R-CO-3 Failure behaviour on ceiling breach `D`

| Breach | Behaviour |
| --- | --- |
| Per-job budget | That job → `FAILED`, `last_error` names the budget. Sibling jobs unaffected. |
| Per-organization ceiling | That organization's remaining jobs stay `QUEUED` for the next run. Published Signals untouched. |
| Per-run ceiling | Dispatch stops; run → `PARTIAL`; reason recorded and surfaced in Action Required. |

A ceiling breach is never silent. A run that quietly processed half the customers is
indistinguishable from a run that found nothing, which is how a cost control becomes a support
incident.

### R-CO-4 Margin must be knowable per customer `D`

Admin **Economics** must answer, per organization and per period, in USD: revenue, COGS, and margin.
With three plans at $19/$49/$99, an unpriced cost structure is how a plan becomes loss-making without
anyone noticing. This is the operational reason R-CU-5 requires attribution rather than aggregate
spend.

### R-CO-5 The numbers are not assumed `S1`

**No numeric ceiling or unit price is defined in this document.**

| Value | Status |
| --- | --- |
| Per-job USD cost budget and token budget | `X` — **OD-CO-2** |
| Per-organization daily USD ceiling | `X` — **OD-CO-2** |
| Per-run USD ceiling | `X` — **OD-CO-2** |
| Per-candidate call limit | `X` — **OD-CO-2** |
| OpenAI USD unit price | `X` — **OD-CO-3** |
| Search provider USD unit price | `X` — **OD-CO-3** |
| Email provider USD unit price | `X` — **OD-CO-3** |

The brief mandates bounded batches but supplies no figures, and the legacy configuration is
unavailable. Choosing a number here would produce a ceiling that looks authoritative the moment it
reaches code, and would silently decide how many Signals a customer receives. **The mechanism is
specified; the values are blocked** — the same discipline applied to plan quotas
([entitlements R-EN-6](../05-billing/entitlements.md#r-en-6-quota-behaviour-x)).

### R-CU-6 Automated enforcement `D`

The prohibition list is enforced by a scan, not by review:

| Check | Fails on |
| --- | --- |
| Schema scan | Any column named `*_idr`, `fx_*`, `*exchange_rate*` |
| Source scan | Any occurrence of `IDR`, `USD_TO_IDR`, `fx_rate`, `exchange_rate`, or `rupiah` **outside exclusion documentation** |
| Schema scan | Any of those identifiers **defined as a field** — a table row whose first column is the identifier |
| Source scan | Any `mayar`, `midtrans`, `convex` reference outside exclusion documentation |
| Dependency scan | Any package matching those names, transitively included |
| Schema scan | Any monetary column without `check (currency = 'USD')` |
| Schema scan | Any monetary column using a floating-point type (`float`, `real`, `double precision`) |
| Schema scan | Any monetary column not named `*_usd` |

A prohibition enforced only by review will eventually be broken by someone who never read this
document.

### R-CO-6 Relationship to quotas `D`

Cost ceilings and plan quotas are **different controls** and must not be conflated:

| | Cost ceiling | Plan quota |
| --- | --- | --- |
| Protects | The operator's margin | The product's tiering |
| Unit | USD (and tokens/calls) | Countable units per plan |
| Visible to customer | No | Yes |
| Source | This document | `packages.limits` — blocked, **B-2** |
| On breach | Job/run degrades; admin alerted | Customer sees a typed denial |

A cost ceiling that silently reduced a customer's Signal count would be an invisible entitlement
change. The two are enforced separately for exactly that reason.

## Security considerations

- **Cost amplification is an attack** (T-16). A monitoring profile that expands candidate volume, or
  anything that can trigger a run, is a spend vector. Bounded batches, per-organization USD ceilings,
  and cron-only dispatch are the controls.
- **`check (currency = 'USD')` is an integrity control.** It makes a currency-override attack
  unrepresentable at the storage layer, independent of any code review.
- **Exact decimal, never floating point.** Binary floats cannot hold `19.99` exactly, and the error
  accumulates into a reconciliation failure nobody can explain.
- **Currency is never derived from context** (R-CU-3). Deriving it from locale or IP means a crafted
  request could influence the unit an amount is interpreted in.
- **Append-only cost entries** make margin auditable. An editable cost history is an editable profit
  statement.
- **Attribution is what makes an anomaly findable.** An unattributed provider call cannot be
  investigated, so "spend went up" has no answer.
- **Ceilings in configuration, not code**, so an operator can respond to a cost incident without a
  deploy — and the change is audited.

## Acceptance criteria

- [ ] Every monetary column in the schema carries `check (currency = 'USD')`.
- [ ] No monetary column uses a floating-point type; all are exact `numeric(p,s)`.
- [ ] Every monetary column is named `*_usd` and paired with a `currency` column constrained to `'USD'`.
- [ ] A negative `amount_usd` is rejected.
- [ ] A non-USD insert into `packages`, `payments`, or `cost_entries` is rejected.
- [ ] A checkout request containing `currency` is rejected with `400` and audited.
- [ ] `IDR`, `amount_idr`, `fx_rate`, `exchange_rate`, `USD_TO_IDR`, and `rupiah` occur **only**
      inside exclusion documentation, and never as a defined field, constant, or identifier.
- [ ] No non-markdown file in the repository contains any of them.
- [ ] No `mayar`, `midtrans`, or `convex` reference exists outside exclusion documentation.
- [ ] No code path derives currency from country, locale, IP, or preference.
- [ ] Every paid provider call records `provider`, `amount_usd`, `currency`, `organization_id`, and `job_id`.
- [ ] Admin Economics reports revenue, COGS, and margin per organization per period, all in USD.
- [ ] Exceeding a per-job budget fails that job only; exceeding the run ceiling yields `PARTIAL` with
      a recorded reason surfaced in Action Required.
- [ ] No numeric ceiling or unit price appears in code or configuration until OD-CO-2 and OD-CO-3 are
      resolved.

## Related skills

- [`release-it`](../SKILLS.md#release-it) — bulkheads and circuit breakers applied to spend.
- [`system-design`](../SKILLS.md#system-design) — cost as a first-class architectural constraint.
- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) — check
  constraints and integer money.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — build the mechanism, withhold the
  number until it is decided; automate the prohibition.

## Open decisions

- **OD-CU-1** Whether to ever display a non-USD estimate, and how it would be labelled. Not decided;
  the default is no.
- **OD-CO-2** The numeric USD ceilings: per-job cost and token budget, per-organization daily ceiling,
  per-run ceiling, per-candidate call limit. **Blocks a safe production daily run.**
- **OD-CO-3** Provider USD unit prices for OpenAI, the search provider, and the email provider,
  verified against current provider pricing. Required before Economics can show margin rather than
  call counts.
- **OD-CO-4** Whether a ceiling breach pages an operator or only queues an Action Required item.
- **OD-CO-5** Whether cost telemetry is retained per call or aggregated per job.
- **OD-CU-2** Whether a provider that publishes pricing in a non-USD currency may be used at all,
  given that recording a converted USD unit price is a manual step rather than a stored rate.
