# Homepage

## Purpose

Specify the public homepage: its message, its structure, its calls to action, and the content rules
that constrain what it may claim.

## Scope

In scope: messaging, structure, plan presentation, and content prohibitions. Out of scope: the
customer surfaces (`customer-dashboard`) and the design system, which is unavailable (OD-LC-2).

## Source of truth

- `S1` Strategic brief — customer as hero, Myelektra Signal as guide, the two CTAs, the plan catalog
  with prices, evidence-backed positioning, and the four content prohibitions.
- `S2` Legacy `docs/product/prd-homepage.md` and `docs/UI-DESIGN-REVIEW.md` — **not available**.
- `X` The evidence that would back the positioning claims (OD-UI-1).

## Requirements

### R-HP-1 Narrative frame `S1`

**The customer is the hero. Myelektra Signal is the guide.** The page is about the customer's
problem and their capability, not about the product's features. Concretely:

| Instead of | Write |
| --- | --- |
| "Our AI-powered platform delivers signals" | "Know what changed at your accounts before your competitor does" |
| "We have six scoring components" | "Every signal shows its source, so you can check it" |
| "Signal Elite includes…" | "Spend Monday morning acting, not searching" |

Feature lists are the guide talking about itself. The hero frame is what makes the page about the
reader.

### R-HP-2 Calls to action `S1`

| CTA | Type | Behaviour |
| --- | --- | --- |
| **Start monitoring** | Primary | Begins sign-up / checkout |
| **See how it works** | Secondary | Explains the process; does not compete visually with the primary |

One primary action per viewport. Two equally-weighted CTAs produce no decision.

### R-HP-3 Plan catalog `S1`

| Plan | Price |
| --- | --- |
| Signal Lite | $19/month |
| Signal Pro | $49/month |
| Signal Elite | $99/month |

Rules:

- Prices are displayed from the authoritative source, never hardcoded where they can drift from
  `packages` (OD-RL-3). A homepage price that disagrees with the charged amount is a billing dispute.
- **What each plan includes may not be described in quota terms until quotas are decided** (B-2).
  Showing "up to 25 accounts" when nobody has decided 25 is exactly the invention the brief forbids.
- USD, monthly. Stated plainly, with no hidden period.

### R-HP-4 Content prohibitions `S1`

| Prohibited | Why |
| --- | --- |
| Fake testimonials | Fabricated social proof; indefensible if challenged |
| Fake logos | Same |
| Fake scarcity | Manufactured urgency that is not real |
| Guaranteed leads, revenue, or meetings | The product surfaces signals; it cannot guarantee commercial outcomes |

These are absolute. A placeholder testimonial "to be replaced later" ships.

### R-HP-5 Evidence-backed positioning `S1`

Claims require support. **What that support is, is undefined** — OD-UI-1. Until it is supplied, the
homepage makes only claims that are true by construction:

| Safe, because true by construction | Unsafe, needs evidence |
| --- | --- |
| "Every signal links to its source" — enforced by BR-SG-01 | "Find 3× more opportunities" |
| "Scores show all six components" — enforced by BR-SG-02 | "Trusted by 500 teams" |
| "Daily monitoring, delivered every morning" — enforced by the cron schedule | "The most accurate signal platform" |

The left column is stronger marketing than the right in any case: it is specific, checkable, and
cannot be contradicted by a customer's own experience.

### R-HP-6 State coverage `S1`

The homepage is mostly static, but its dynamic parts still owe states: plan catalog loading, plan
catalog failed (with retry), and a checkout-initiation pending state. A pricing section that renders
blank while loading teaches a visitor that the page is broken.

### R-HP-7 Accessibility and responsiveness `S1`

Keyboard-navigable, axe-clean, verified at 360px, 768px, and 1440px. The primary CTA must be reachable
and operable by keyboard, and contrast must hold in every theme.

### R-HP-8 No dummy data `S1`

No invented Signals, companies, metrics, or customer counts appear on the homepage. An illustrative
example must be visibly labelled as illustrative.

## Security considerations

- **Price display authority** (R-HP-3). A hardcoded price can drift from `packages`, producing a
  documented price that differs from the charged amount. That is a contractual problem, not a UI bug.
- **Guaranteed-outcome claims are legal exposure**, not only a credibility issue.
- **No secrets in the bundle**, including the PayPal public client id being mistaken for a secret and
  the reverse error — a real secret given a public prefix.
- **The checkout initiation sends a plan key only** ([R-PP-3](../05-billing/paypal.md#r-pp-3-what-the-browser-may-not-supply-s1)).
  A homepage form that posts an amount is a payment bypass waiting for a curious visitor.

## Acceptance criteria

- [ ] The primary CTA is "Start monitoring"; the secondary is "See how it works".
- [ ] All three plans display with the correct USD monthly prices sourced from `packages`.
- [ ] No testimonial, logo, or scarcity element exists that cannot be substantiated.
- [ ] No guaranteed lead, revenue, or meeting claim appears anywhere on the page.
- [ ] Every quantitative claim is either enforced by construction or omitted.
- [ ] Plan catalog loading, failed, and retry states render correctly.
- [ ] The page is keyboard-navigable and passes axe.
- [ ] The page is verified at 360px, 768px, and 1440px.
- [ ] Checkout initiation transmits a plan key and no monetary value.

## Related skills

- [`storybrand-messaging`](../SKILLS.md#storybrand-messaging) — R-HP-1's hero/guide frame.
- [`made-to-stick`](../SKILLS.md#made-to-stick) — a message that survives being repeated.
- [`one-page-marketing`](../SKILLS.md#one-page-marketing) — single-page structure and flow.
- [`obviously-awesome`](../SKILLS.md#obviously-awesome) — positioning against the alternative, which
  is "keep searching manually".
- [`refactoring-ui`](../SKILLS.md#refactoring-ui) — hierarchy with one primary CTA.
- [`web-typography`](../SKILLS.md#web-typography) — reading comfort on a text-led page.

## Open decisions

- **OD-UI-1** What evidence backs the positioning claims.
- **OD-LC-2** Clean Clay definition. **Blocks visual implementation.**
- **OD-RL-3** Whether prices are served from the bundle or from an `anon`-granted view.
- **OD-HP-1** Is an FAQ or a "how it works" section required? "See how it works" implies one exists.
- **OD-HP-2** SEO requirements, which interact with the SPA decision (OD-FE-1).
