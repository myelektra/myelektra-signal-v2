# Pricing

## Purpose

The authoritative statement of what the product costs, in what currency, where that price lives, and
what is deliberately left undefined. This is the document to read before touching anything that
displays or charges money.

## Scope

In scope: the catalog, currency, price authority, display rules, and change procedure. Out of scope:
what a plan *includes* ([entitlements](entitlements.md)), the single-currency rule
([currency-and-cost-policy](../00-product/currency-and-cost-policy.md)), and the payment flow
([paypal](paypal.md)).

## Source of truth

- `S1` Strategic brief — the three plans and their prices, USD, monthly billing, and the rule that
  the Edge Function resolves the authoritative package and price server-side.
- Owner directive (2026-08-29) — all prices, payments, and subscriptions are in USD; no IDR, no FX,
  no conversion.
- `S2`/`S3` Legacy pricing configuration — **not available**. Whether the legacy product priced in IDR
  is unknown and **irrelevant**, because nothing is carried over.
- `X` Per-plan quotas and entitlements — **B-2**. Not invented here.

## Requirements

### R-PR-1 The catalog `S1`

| Plan key | Display name | Price | Currency | Interval |
| --- | --- | --- | --- | --- |
| `signal_lite` | Signal Lite | $19.00 | USD | monthly |
| `signal_pro` | Signal Pro | $49.00 | USD | monthly |
| `signal_elite` | Signal Elite | $99.00 | USD | monthly |

Stored as integer cents: `1900`, `4900`, `9900`. No float money, at any layer.

There are exactly three plans. A fourth plan is a product decision, not a configuration change.

### R-PR-2 Currency `S1`

Every price is USD. The `packages.currency` column carries `check (currency = 'USD')`, so a non-USD
price is not representable. No conversion, no display currency, no country-based inference —
see [currency-and-cost-policy R-CU-1…R-CU-3](../00-product/currency-and-cost-policy.md#r-cu-1-single-currency-every-surface-s1).

### R-PR-3 The database is the price authority `S1`

```
packages.key → packages.price_cents → charged amount
```

| Rule | Why |
| --- | --- |
| The browser sends a **plan key only** | A client-supplied amount is a payment bypass |
| The Edge Function reads the price from `packages` at order-creation time | The charge cannot be influenced by the request |
| No price is hardcoded in frontend code | A hardcoded price drifts from `packages`, and the drift becomes a billing dispute |
| A price change is a data change | It gets an audit trail, and applies to orders created after it |
| Historical `payments` rows keep the amount actually charged | The ledger records what happened, not the current price |

The last two together define change semantics: changing a price never rewrites history.

### R-PR-4 Display `S1` + `D`

| Rule | Note |
| --- | --- |
| Displayed prices come from the authoritative source, never a hardcoded literal | Prevents drift (R-PR-3) |
| Prices are shown as USD with the interval stated | "$49/month" — no hidden period |
| No price appears without its interval | A bare "$49" is ambiguous |
| No strike-through "was $X" pricing | That is manufactured urgency; prohibited by [product-requirements R-PR-6](../00-product/product-requirements.md#r-pr-6-content-rules-s1) |
| No per-seat or per-usage price is displayed | None exists; inventing one in the UI would misrepresent the plan |

The display source is **OD-RL-3**: either the bundle (simple, but a price change needs a deploy) or an
`anon`-granted view over active packages (no deploy, but a new public surface). Not decided.

### R-PR-5 What each plan includes `X`

**Undefined, and deliberately so.** The brief fixes the three price points and nothing else.

| Undefined | ID |
| --- | --- |
| Monitored accounts per plan | BR-PK-06 |
| Signals delivered per day per plan | BR-PK-06 |
| Seats per plan | BR-PK-06 |
| Contacts and opportunities per plan | BR-PK-06 |
| Feature gates versus volume gates | BR-PK-09 |
| Quota enforcement mode | BR-PK-07 |
| Rollover | BR-PK-08 |
| Mid-cycle change effect | BR-PK-10 |

This is blocker **B-2**. Consequences that are already visible:

- `packages.limits` exists as a column and is `{}` in the baseline.
- The homepage may show the three prices but **may not describe a plan in quota terms**
  ([homepage R-HP-3](../09-ui/homepage.md#r-hp-3-plan-catalog-s1)).
- The customer dashboard's usage surfaces cannot be specified.

A guessed quota would be worse than an absent one: it would charge $99 for an arbitrary amount of
something nobody decided, and it would look authoritative the moment it shipped.

### R-PR-6 Price change procedure `D`

| Step | Rule |
| --- | --- |
| 1 | The change is recorded as a new value in `packages`, with the previous value preserved in `audit_logs` (`before`/`after`). |
| 2 | Existing subscriptions are **not** repriced automatically. Repricing a paying customer without consent is a decision, not a side effect — **OD-PR-2**. |
| 3 | New orders use the new price from the moment it is written. |
| 4 | The PayPal-side plan is updated to match, and the two are verified to agree before the change is considered complete. |
| 5 | The change is visible in admin **Packages** with its effective time and actor. |

Step 4 matters: `packages.price_cents` and the provider-side plan are two representations of one
fact. A change applied to only one produces charges that contradict the catalog.

### R-PR-7 Relationship to cost `D`

Price is revenue; cost is COGS. Both are USD, and margin is the difference
([currency-and-cost-policy R-CU-5](../00-product/currency-and-cost-policy.md#r-cu-5-cost-accounting-in-usd-s1--d)).
A plan's viability cannot be assessed while its cost ceilings and provider unit prices are blocked
(**OD-CO-2**, **OD-CO-3**). That is a reason to resolve those before launch, not a reason to guess
them here.

## Security considerations

- **Client-controlled price is free service.** R-PR-3 exists so that no request can influence the
  amount charged. A checkout endpoint that accepts an amount is a bypass waiting for a curious
  visitor.
- **`check (currency = 'USD')`** makes a currency-override attack unrepresentable at storage,
  independent of code review.
- **No hardcoded prices in the bundle.** Beyond drift, a hardcoded price is a price an attacker can
  read and compare against the charged amount to probe for inconsistency.
- **Price changes are audited** (R-PR-6). An unaudited price change is indistinguishable from a
  fraudulent one.
- **Existing subscriptions are not silently repriced.** Automatic repricing of a paying customer is
  both a trust failure and, in many jurisdictions, a contractual one.

## Acceptance criteria

- [ ] `packages` contains exactly the three rows in R-PR-1, with the stated cent values.
- [ ] `packages.currency` carries `check (currency = 'USD')`; a non-USD insert is rejected.
- [ ] No monetary value is stored as a float anywhere in the schema.
- [ ] A checkout request containing `amount`, `price`, or `currency` is rejected with `400` and audited.
- [ ] The charged amount equals `packages.price_cents` for each of the three plan keys, asserted by test.
- [ ] No price literal appears in frontend source.
- [ ] `packages.limits` is `{}` in the baseline, with a comment referencing B-2.
- [ ] A price change writes an audit entry with before and after values.
- [ ] After a price change, `packages` and the provider-side plan agree, verified before completion.
- [ ] No plan is described in quota terms anywhere in the product until B-2 is resolved.

## Related skills

- [`obviously-awesome`](../SKILLS.md#obviously-awesome) — price positioning against the alternative.
- [`one-page-marketing`](../SKILLS.md#one-page-marketing) — how the catalog reads on the homepage.
- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) — integer money
  and check constraints.
- [`clean-architecture`](../SKILLS.md#clean-architecture) — one authority for the price.

## Open decisions

- **B-2 / OD-BR-1** Per-plan quotas and entitlements. **Blocks any description of what a plan
  includes**, the usage surfaces, and quota tests.
- **OD-RL-3** Whether displayed prices come from the bundle or an `anon`-granted view.
- **OD-PR-1** Whether an annual interval is ever offered. Not in the brief; assumed absent.
- **OD-PR-2** Whether and how existing subscriptions are repriced on a catalog change.
- **OD-PR-3** Whether a free trial exists. Not in the brief; assumed absent (also OD-UI-2).
- **OD-CO-2 / OD-CO-3** Cost ceilings and provider unit prices, needed to evaluate margin per plan.
