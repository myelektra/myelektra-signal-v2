# Customer Dashboard

## Purpose

Specify the customer-facing product surfaces: what each screen is for, what the primary action is,
and how the Signal detail separates fact from interpretation.

## Scope

In scope: the surface inventory, the primary action, the Signal detail structure, and state coverage.
Out of scope: the design system (OD-LC-2) and the underlying domain rules (`04-signals/*`).

## Source of truth

- `S1` Strategic brief — the surface list, the primary action, and the six-section Signal detail.
- `S2` Legacy `docs/product/prd-customer-dashboard.md` and `docs/UI-DESIGN-REVIEW.md` — **not
  available**.
- `D` Design decisions proposed here.

## Requirements

### R-CD-1 Surfaces `S1`

| Surface | Purpose |
| --- | --- |
| Overview | Today at a glance; routes to the primary action |
| Signals | The list of published Signals, filterable and ordered |
| Signal detail | One Signal, in six sections |
| Opportunities | Commercial follow-ups the customer is working |
| Accounts | Monitored accounts and their state |
| Contacts | People associated with accounts and opportunities |
| Billing | Subscription, plan, payment history, cancellation |
| Settings | Monitoring profile, delivery preferences, account |
| Notifications | What the system has told them and when |

### R-CD-2 Primary action `S1`

```
Review today's Signals
```

This is the dashboard's reason to exist and is the most prominent action on Overview. Everything else
is secondary. A dashboard whose primary action competes with eight navigation items has no primary
action.

### R-CD-3 Signal detail `S1`

Six separated sections. The separation is the requirement:

| Section | Content | Source |
| --- | --- | --- |
| **WHAT HAPPENED** | The event, factually | `subject_name`, `summary` |
| **WHY IT MATTERS** | Commercial implication | `commercial_implication` |
| **WHAT TO DO NEXT** | Recommended action | `recommended_action` |
| **SOURCE EVIDENCE** | Source name, URL, summary, verification state | `signal_evidence` |
| **SCORE EXPLANATION** | The six components and how they sum to the score | `score_components` |
| **CONFIDENCE AND LIMITATIONS** | Confidence, freshness, limitations | `confidence`, `freshness`, `limitations` |

Why the separation is load-bearing:

- Merging `WHAT HAPPENED` with `WHY IT MATTERS` turns a fact into an opinion the customer cannot
  separate from evidence.
- Omitting `SCORE EXPLANATION` makes the score an assertion. Showing the components lets a customer
  disagree intelligently — which is how the product earns trust when it is wrong.
- Hiding `CONFIDENCE AND LIMITATIONS` is how a signal product loses credibility the first time it is
  wrong. An absent limitation must render as "no limitations recorded", not as an empty section that
  looks broken.

The frontend renders stored values. It never computes a score, band, or component
([scoring R-SC-5](../04-signals/scoring.md#r-sc-5-computed-server-side-rendered-client-side-s1)).

### R-CD-4 Eight states per route `S1`

Loading, empty, partial, failed, retryable error, mutation pending, success, stale data — every
route, per [test-strategy R-TS-4](../10-testing/test-strategy.md#r-ts-4-state-variant-coverage-s1).
The ones that matter most here:

| State | Where it matters | Requirement |
| --- | --- | --- |
| Empty | Signals on a quiet day | Distinct from failed; says "no Signals today", not "something broke" |
| Failed | Any fetch | Says why, offers retry |
| Partial | Overview aggregating several queries | Labels what did not load |
| Stale | Signals viewed later in the day | Indicates the data's age |
| Mutation pending | Billing and Settings changes | Disables the control; prevents double submit |

### R-CD-5 Billing surface `S1` + `D`

Reads subscription state, plan, and payment history from the server. Rules:

- Amounts and states are displayed, never editable. A customer cannot change access state, role, or
  price from any surface (BR-AC-02, BR-RB-02).
- Plan change transmits a plan key only ([R-PP-3](../05-billing/paypal.md#r-pp-3-what-the-browser-may-not-supply-s1)).
- Payment history shows internal ledger state, not raw provider payloads.
- Cancellation behaviour is undefined (OD-PP-5), so the surface cannot be fully specified. It is not
  invented here.

### R-CD-6 Access-gated rendering `S1`

The dashboard renders according to the resolution flow in
[R-AU-4](../03-auth/authentication-authorization.md#r-au-4-resolution-sequence-s1): a
`PENDING_PAYMENT` member sees checkout, a `PAID_ONBOARDING` member sees onboarding, an `ACTIVE`
member sees the product. Route guards are UX; the server denies data independently.

### R-CD-7 No dummy data `S1`

An empty dashboard is correct. Invented Signals are not. Demonstration content, if any, is labelled
and cannot reach a production tenant.

## Security considerations

- **No score computation client-side.** A customer-facing recomputation could display a number that
  differs from the stored one, which is how a product ends up arguing with its customer.
- **Evidence links are validated.** `source_url` comes from the open web; a `javascript:` URL rendered
  as a link is an execution vector. Links are restricted to `http(s)`.
- **Evidence text renders as text.** Stored XSS via scraped content is a real vector
  ([threat T-14](../07-security/threat-model.md#r-tm-2-threats-and-controls)).
- **Billing displays are read-only.** Any editable monetary or state field on a customer surface is a
  billing bypass candidate.
- **Cross-tenant attempts return `404`**, so a crafted request cannot probe for another tenant's
  existence.
- **Stale-data indication** is a security-adjacent control in billing: showing an outdated plan as
  current causes customers to act on wrong entitlement information.

## Acceptance criteria

- [ ] "Review today's Signals" is the most prominent action on Overview.
- [ ] All nine surfaces exist and are reachable by an `ACTIVE` member.
- [ ] Signal detail renders all six sections, including an explicit empty state for limitations.
- [ ] The rendered score and components exactly equal the stored values.
- [ ] Every route renders all eight states, each covered by a test.
- [ ] Empty and failed states are textually and visually distinct on every route.
- [ ] No monetary or access-state field is editable by a customer.
- [ ] A `source_url` with a non-`http(s)` scheme is not rendered as a link.
- [ ] Every route is keyboard-navigable, axe-clean, and verified at 360px, 768px, 1440px.
- [ ] No route displays invented Signals or metrics.

## Related skills

- [`ux-heuristics`](../SKILLS.md#ux-heuristics) — visibility of system status, error recovery, recognition over recall.
- [`refactoring-ui`](../SKILLS.md#refactoring-ui) — hierarchy across nine surfaces.
- [`design-everyday-things`](../SKILLS.md#design-everyday-things) — affordances for the eight states.
- [`web-typography`](../SKILLS.md#web-typography) — the Signal detail view is dense text.
- [`made-to-stick`](../SKILLS.md#made-to-stick) — the six-section structure as a memorable frame.

## Open decisions

- **OD-LC-2** Clean Clay definition. **Blocks visual implementation.**
- **OD-PP-5** Cancellation behaviour, which determines the Billing surface's actions.
- **OD-CD-1** Opportunities and Contacts semantics — both are named surfaces whose domain rules are
  undefined.
- **OD-CD-2** Whether Notifications is a surface, a popover, or both.
- **OD-CD-3** Signal list ordering and filtering, which depends on the signal taxonomy (OD-BR-2).
- **OD-FE-4** Whether the six detail sections are tabs, stacked, or progressive disclosure.
