# Subscriptions

## Purpose

Define the subscription lifecycle: how a subscription is created, renewed, cancelled, and failed —
and mark clearly which behaviours are mandated and which remain undefined.

## Scope

In scope: the subscription record, lifecycle states, and the transition triggers. Out of scope:
provider mechanics ([paypal](paypal.md)), what a subscription grants ([entitlements](entitlements.md)),
and drift correction ([reconciliation](reconciliation.md)).

## Source of truth

- `S1` Strategic brief — monthly subscription, USD, PayPal as sole provider, and the requirement that
  renewal, cancellation, and payment failure are all handled and that refunds and disputes are
  recorded.
- `S2` Legacy `payment-provider-strategy.md` — **not available**.
- `X` The actual lifecycle behaviour is undefined and is not invented here.

## Requirements

### R-SB-1 The record `D`

A `subscriptions` row exists per organization per active plan, carrying `organization_id` (INV-1),
`package_id`, provider-scoped identifiers, internal state, and period boundaries. Provider
identifiers follow the naming rule in
[schema R-DB-5](../02-database/schema.md#r-db-5-provider-scoping-s1): `provider_subscription_id`,
never a bare `subscription_id`.

### R-SB-2 Creation `S1`

A subscription record is created when a PayPal subscription is initiated, in a non-entitling state,
and moves to an entitling state only after settlement (BR-PM-10). Creating it in an entitling state
at initiation would grant access on buyer intent.

### R-SB-3 Lifecycle events that must be handled `S1`

| Event | Requirement | Behaviour |
| --- | --- | --- |
| Renewal success | Must be handled | `X` — OD-PP-4 |
| Renewal failure | Must be handled | `X` — grace period and dunning are BR-SB-05 |
| Cancellation | Must be handled and recorded | `X` — OD-PP-5 |
| Refund | Must be recorded (BR-SB-03) | Effect on access state is `X` — OD-PP-6 |
| Dispute | Must be recorded | Effect on access state is `X` — OD-PP-6 |

The left column is a requirement from the brief. The right column is genuinely unknown. This table is
half-empty on purpose: filling the `X` cells without a source would mean inventing payment lifecycle
behaviour, which the brief forbids.

### R-SB-4 State mapping `X`

The mapping from PayPal subscription state to internal subscription state is **undefined** (BR-SB-04)
and depends on OD-PP-1, which requires reading provider documentation. Until both are resolved, no
state machine is written down, because a guessed mapping would silently define when a customer loses
access.

### R-SB-5 Relationship to access state `S1` + `D`

Subscription state drives access state, but they are not the same thing:

| Subscription | Access state |
| --- | --- |
| Initiated, unsettled | `PAYMENT_PROCESSING` |
| Settled, onboarding incomplete | `PAID_ONBOARDING` |
| Active, onboarded | `ACTIVE` |
| Failed renewal, in grace | **`X`** — BR-AC-07 |
| Cancelled at period end, period not elapsed | **`X`** — OD-PP-5 |
| Refunded / disputed | **`X`** — OD-PP-6 |

The three `X` rows are the ones a customer will notice, which is exactly why they must be decided
rather than defaulted. A default of "immediately `SUSPENDED`" on a failed renewal is a defensible
product choice — but it is a choice, and making it silently in code would be a decision nobody
approved.

### R-SB-6 Authority `S1`

Subscription state is server-owned. Customers cannot set or change it (BR-AC-02). Enforced by RLS
denial and column `GRANT` denial on the whole table
([rls R-RL-4](../02-database/rls.md#r-rl-4-column-protection-is-not-rls-s1)).

### R-SB-7 Plan change `X`

Mid-cycle upgrade or downgrade behaviour is undefined (BR-PK-10): whether quota changes immediately,
whether proration applies (OD-PP-5 adjacent), and what happens to Signals already delivered. Not
invented here.

## Security considerations

- **Subscription state is authority.** Anyone who can write it can grant themselves access. The whole
  table is write-denied to clients.
- **Provider events are the only legitimate driver** of lifecycle transitions, alongside explicit
  audited admin action. A transition triggered by anything else is a defect.
- **Grace-period behaviour is a revenue and trust decision**, not an implementation detail. Both
  extremes — instant suspension and unlimited grace — have real costs.
- **Every transition is audited** (BR-PM-12), including admin overrides, which are the transitions
  most worth reviewing later.

## Acceptance criteria

- [ ] A subscription record exists before settlement and does not grant entitlement.
- [ ] Entitlement is granted only after verified settlement.
- [ ] A customer `UPDATE` on `subscriptions` is denied.
- [ ] Every lifecycle transition writes an audit entry with before and after state.
- [ ] Renewal, cancellation, failure, refund, and dispute each produce a record — verified by test
      once behaviours are defined.
- [ ] No transition occurs without a provider event or an audited admin action.

## Related skills

- [`system-design`](../SKILLS.md#system-design) — state machines and their failure edges.
- [`ddia-systems`](../SKILLS.md#ddia-systems) — converging local state with an external source of truth.
- [`release-it`](../SKILLS.md#release-it) — graceful degradation on provider failure.

## Open decisions

- **OD-SB-1 / BR-SB-04** Provider-to-internal state mapping. Requires OD-PP-1.
- **OD-PP-4** Renewal failure: grace period, dunning, access state during dunning.
- **OD-PP-5** Cancellation: end-of-period vs immediate; refund policy.
- **OD-PP-6** Refund and dispute effect on access state.
- **OD-BR-10 (BR-PK-10)** Mid-cycle plan change semantics.
