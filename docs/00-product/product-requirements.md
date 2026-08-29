# Product Requirements

## Purpose

State what Myelektra Signal v2 is, who it serves, and what it must do — as the input to every design
document in this set.

## Scope

In scope: product definition, actors, the surface inventory, pricing, and the content rules that
constrain marketing claims. Out of scope: how any of it is built (see `01-architecture` onward) and
the detailed rule register ([business-rules](business-rules.md)).

## Source of truth

- `S1` Strategic brief — the plan catalog, the UI surface inventory, the primary CTAs, the Signal
  detail structure, and the content prohibitions.
- `S2` Legacy `docs/product/*.md` (`00-prd.md`, `01-prd-supabase-beta.md`, `prd-homepage.md`,
  `prd-customer-dashboard.md`, `prd-admin-dashboard.md`) — **not available**. The brief instructs
  that these be read as the source of truth for Phase 5 and 6; that instruction cannot be followed
  until they are supplied. See [forensic-audit](forensic-audit.md) and **B-1**.
- `D` Design decisions proposed here.

## Requirements

### R-PR-1 Product definition `S1` + `D`

Myelektra Signal monitors a customer's chosen accounts and market, finds commercial signals backed
by real evidence, and tells the customer what happened, why it matters, and what to do next.

The defining product constraint is BR-SG-01: **no evidence, no published Signal.** The product's
value proposition is credibility, so a Signal that cannot show its source does not ship. This is a
product rule that happens to be enforced in the database, not a technical detail.

### R-PR-2 Actors `S1`

| Actor | Goal |
| --- | --- |
| Customer | Understand today's opportunities in their accounts and act on them |
| Admin | Keep the pipeline healthy, resolve failures, and see what happened |
| Super admin | Control roles, packages, and platform configuration |

### R-PR-3 Plan catalog `S1`

| Plan | Price | Interval |
| --- | --- | --- |
| Signal Lite | $19 | monthly |
| Signal Pro | $49 | monthly |
| Signal Elite | $99 | monthly |

USD only. What each plan includes beyond price is **undefined** — B-2 / OD-BR-1. The catalog may be
displayed; it may not be described in terms of quotas until quotas are decided.

### R-PR-4 Surface inventory `S1`

**Homepage** — primary CTA `Start monitoring`, secondary CTA `See how it works`, plan catalog,
evidence-backed positioning. Detail in [homepage](../09-ui/homepage.md).

**Customer dashboard** — Overview, Signals, Signal detail, Opportunities, Accounts, Contacts,
Billing, Settings, Notifications. Primary action: `Review today's Signals`. Detail in
[customer-dashboard](../09-ui/customer-dashboard.md).

**Admin dashboard** — System health, Action Required queue, Customers, Daily Reports, Usage &
Quotas, Packages, Economics, Audit Log, Settings. Detail in
[admin-dashboard](../09-ui/admin-dashboard.md).

### R-PR-5 Signal detail structure `S1`

The Signal detail view separates six concerns, and the separation is a requirement rather than a
layout preference:

```
WHAT HAPPENED
WHY IT MATTERS
WHAT TO DO NEXT
SOURCE EVIDENCE
SCORE EXPLANATION
CONFIDENCE AND LIMITATIONS
```

Merging any two of these degrades the product's core promise. `SCORE EXPLANATION` exists because a
number without its components is an assertion; `CONFIDENCE AND LIMITATIONS` exists because hiding
uncertainty is how a signal product loses trust.

### R-PR-6 Content rules `S1`

Absolute prohibitions on homepage and product copy:

| Prohibited | Why |
| --- | --- |
| Fake testimonials | Fabricated social proof is fraud and is indefensible if challenged |
| Fake logos | Same |
| Fake scarcity | Manufactured urgency that is not real |
| Guaranteed leads, revenue, or meetings | The product finds signals; it cannot guarantee commercial outcomes |

And one positive requirement: positioning must be **evidence-backed**. A claim on the homepage needs
something behind it. What that evidence is, is **OD-UI-1** — it cannot be invented either.

The customer is the hero; Myelektra Signal is the guide. The product does not claim to close deals;
it claims to surface what is happening and what to do about it.

### R-PR-7 State coverage `S1`

Every route supports loading, empty, partial, failed, retryable error, mutation pending, success, and
stale data. This is a product requirement, not a QA nicety: a product whose empty state is
indistinguishable from its error state teaches customers to distrust it. See
[test-strategy R-TS-4](../10-testing/test-strategy.md#r-ts-4-state-variant-coverage-s1).

### R-PR-8 No dummy production data `S1`

The product never ships invented Signals, companies, or metrics. An empty dashboard with an honest
empty state is correct; a populated one with fabricated content is a defect. This also applies to
staging and demo environments, which must label any seeded content explicitly.

## Security considerations

- Content rules in R-PR-6 are also legal exposure. Guaranteed-outcome claims about a paid product are
  actionable in many jurisdictions.
- R-PR-8 prevents fabricated data reaching a real tenant. Demonstration content must be labelled and
  structurally unable to enter a production organization.
- The plan catalog's authority lives server-side (BR-PK-05). A homepage that hardcodes prices can
  drift from `packages`, creating a discrepancy that becomes a billing dispute. The display source
  decision is OD-RL-3.

## Acceptance criteria

- [ ] The plan catalog shown to customers matches `packages` exactly, for all three plans.
- [ ] No homepage claim is a guaranteed commercial outcome.
- [ ] No testimonial, logo, or scarcity element exists that cannot be substantiated.
- [ ] Every route renders all eight states in R-PR-7.
- [ ] No route displays invented Signals or metrics in any environment.
- [ ] The Signal detail view renders all six sections of R-PR-5, including empty limitations.

## Related skills

- [`storybrand-messaging`](../SKILLS.md#storybrand-messaging) — customer as hero, product as guide (R-PR-6).
- [`made-to-stick`](../SKILLS.md#made-to-stick) — homepage message retention.
- [`one-page-marketing`](../SKILLS.md#one-page-marketing) — homepage structure.
- [`obviously-awesome`](../SKILLS.md#obviously-awesome) — positioning against alternatives.
- [`ux-heuristics`](../SKILLS.md#ux-heuristics) — R-PR-7 state coverage.

## Open decisions

- **B-1** The legacy PRDs are unavailable, so this document is derived from the brief alone. When
  they are supplied, this document must be reconciled against them and any conflict recorded.
- **B-2 / OD-BR-1** Plan quotas and entitlements. Blocks any description of what a plan includes.
- **OD-UI-1** What evidence backs the homepage positioning claims.
- **OD-UI-2** Whether a free trial exists. Not mentioned in the brief; assumed absent. Tagged `X`.
