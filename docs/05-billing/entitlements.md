# Entitlements

## Purpose

Define what an organization is allowed to use, how that is derived, and how it is enforced — while
recording plainly that the contents of each plan are undecided.

## Scope

In scope: the entitlement model, its derivation, enforcement points, and change behaviour. Out of
scope: package pricing ([schema](../02-database/schema.md#r-db-3-core-entities-d)) and subscription
lifecycle ([subscriptions](subscriptions.md)).

## Source of truth

- `S1` Strategic brief — the three plans and their prices, USD, monthly billing, server-side plan
  resolution, and the flow in which entitlement updates follow settlement.
- `X` **The contents of each plan are undefined.** BR-PK-06 … BR-PK-10. This is blocker **B-2**.

## Requirements

### R-EN-1 Derivation `D`

```
organizations.package_id → packages → limits → entitlement
```

Entitlement is **derived**, never stored as an independent authority. Storing entitlement separately
creates two sources of truth that will disagree, and the disagreement resolves in the customer's
favour whenever anyone forgets to update both.

### R-EN-2 The price is authoritative server-side `S1`

The browser sends a plan key. The Edge Function resolves the package and reads the price from
`packages` (BR-PK-04, BR-PK-05). The amount charged can therefore never be influenced by the client,
and a price change is a data change with an audit trail rather than a frontend deploy.

### R-EN-3 Enforcement points `D`

| Point | Enforces | Why here |
| --- | --- | --- |
| Edge Function, before the action | Whether the organization may perform it | Fails fast, with a typed denial the UI can render |
| Pipeline dispatch | Whether an organization is included in today's run | Prevents cost being spent for an unentitled tenant |
| Database constraint or trigger | Where a limit is a countable row | The last line; cannot be bypassed by a new code path |

Enforcement in the database matters for countable limits: a new endpoint that inserts rows would
otherwise silently bypass an application-level check.

### R-EN-4 Grant timing `S1`

Entitlement updates only after settlement succeeds, moving access state
`PAYMENT_PROCESSING → PAID_ONBOARDING` and then `→ ACTIVE` on onboarding completion (BR-PM-10).
Granting before settlement is the client-side form of the PayPal `onApprove` defect.

### R-EN-5 Revocation `X`

What happens to entitlement on suspension, cancellation, refund, or dispute is **undefined**
(BR-AC-07…09, OD-PP-6). Specifically undecided: whether a suspended organization retains read access
to Signals already delivered. That is a visible customer-facing decision and it is not made here.

### R-EN-6 Quota behaviour `X`

| Question | ID |
| --- | --- |
| Per-plan quotas: monitored accounts, Signals/day, seats, contacts, opportunities | BR-PK-06 |
| Enforcement mode: hard stop, soft warning, or overage | BR-PK-07 |
| Whether unused quota rolls over | BR-PK-08 |
| Feature gates vs volume gates per plan | BR-PK-09 |
| Mid-cycle change effect | BR-PK-10 |

The mechanism is designed: `usage` counters, unique per `(organization_id, period_start, metric)`,
write-denied to clients so a customer cannot reset their own counter
([rls R-RL-4](../02-database/rls.md#r-rl-4-column-protection-is-not-rls-s1)). The **metric list is not
invented**. The `packages.limits` column exists and is `{}` in the baseline.

This is the clearest example in the documentation set of a mechanism being specified while its policy
is withheld. Shipping guessed quotas would produce a product that charges $99 for an arbitrary amount
of something nobody decided.

## Security considerations

- **Client-controlled entitlement is free service.** Any path where a request can influence
  `package_id`, `limits`, or `usage.quantity` is a billing bypass.
- **`usage.quantity` is write-denied to clients.** A customer who can reset their counter has
  unlimited quota.
- **Derivation over storage** (R-EN-1) removes an entire class of drift bugs in which a customer
  retains an old plan's entitlement after a downgrade.
- **Enforcement in the pipeline dispatcher is a cost control.** Running the pipeline for an
  unentitled organization spends real money on model and search calls for no revenue.
- **Denials are typed**, so the UI can show "upgrade to add another account" rather than a generic
  error — which is also what prevents a customer from retrying into a broken state.

## Acceptance criteria

- [ ] Entitlement is derived from `packages` at read time; no separate entitlement authority exists.
- [ ] A customer `UPDATE` on `usage.quantity` is denied.
- [ ] A customer `UPDATE` on `organizations.package_id` is denied.
- [ ] Entitlement is granted only after verified settlement, asserted by test.
- [ ] The pipeline dispatcher excludes organizations without an active entitlement.
- [ ] Every quota denial returns a typed code the UI can act on.
- [ ] `packages.limits` is `{}` in the baseline, with a comment referencing B-2.

## Related skills

- [`clean-architecture`](../SKILLS.md#clean-architecture) — entitlement as derived domain policy.
- [`system-design`](../SKILLS.md#system-design) — one source of truth.
- [`ux-heuristics`](../SKILLS.md#ux-heuristics) — a denial that explains itself.

## Open decisions

- **B-2 / OD-BR-1** Per-plan quotas and entitlements. **Blocks the checkout plan description, the
  usage surfaces, and quota tests.**
- **OD-BR-7** Enforcement mode (hard stop vs soft warn vs overage).
- **OD-BR-8** Rollover.
- **OD-EN-1** Feature gates vs volume gates per plan.
- **OD-EN-2** Entitlement behaviour on suspension and refund (shared with OD-PP-6).
