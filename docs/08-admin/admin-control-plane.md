# Admin Control Plane

## Purpose

Define the server-side control plane behind the admin dashboard: what actions exist, how each is
authorized, and how each is made safe to run against production data.

## Scope

In scope: the action inventory, authorization, audit, and mutation safety. Out of scope: the admin UI
([admin-dashboard](../09-ui/admin-dashboard.md)) and the RLS matrix
([rls](../02-database/rls.md#r-rl-3-policy-matrix-s1--d)).

## Source of truth

- `S1` Strategic brief — admin surfaces (System health, Action Required, Customers, Daily Reports,
  Usage & Quotas, Packages, Economics, Audit Log, Settings), server-side authorization, and audit
  logging for privileged mutations.
- `S2` Legacy `docs/product/prd-admin-dashboard.md` and `docs/ADMIN-DASHBOARD-UI-CODE-REVIEW.md` —
  **not available**.
- `X` The `ADMIN` vs `SUPER_ADMIN` permission matrix is undefined (OD-RB-2).

## Requirements

### R-AD-1 Authorization `S1`

Every admin action is authorized server-side on every request (BR-RB-03). No admin capability is
reachable from the customer-facing function set, and no admin action trusts a route, a header, or a
client-supplied role.

Admin functions are separate from customer functions ([backend R-BE-1](../01-architecture/backend.md#r-be-1-function-inventory-d)),
so a defect in a customer handler cannot expose an admin capability.

### R-AD-2 Action inventory `D`

| Surface | Actions | Mutating |
| --- | --- | --- |
| System health | Read pipeline, job, queue, and reconciliation status | No |
| **Action Required** | Read the queue; retry a failed job; resolve a discrepancy; acknowledge | **Yes** |
| Customers | Read organizations, memberships, access state; suspend; reinstate; adjust access state | **Yes** |
| Daily Reports | Read runs and their outcomes | No |
| Usage & Quotas | Read counters; adjust a counter with a reason | **Yes** |
| Packages | Read catalog; change a price; activate/deactivate a plan | **Yes** |
| Economics | Read aggregates | No |
| Audit Log | Read; **never write, update, or delete** | No |
| Settings | Read and write platform configuration | **Yes** |

**Action Required is the priority surface** (per the brief's Phase 6 ordering). It is where an
operator turns a customer-visible failure into a resolved one, so it is designed first.

### R-AD-3 Audit `S1`

Every mutating admin action writes to `audit_logs` with actor, role at the time of the act, action,
entity, and before/after state (BR-RB-04). Additional rules:

- **Failed authorization attempts on admin actions are audited too.** A repeated
  `insufficient_role` on an admin endpoint is an attack signal, not noise.
- **A reason is required** for any action that changes a customer's access, quota, or entitlement.
  An unexplained override is indistinguishable from an abusive one when reviewed later.
- The audit log is append-only (BR-RB-05) — no update or delete path for any role, including
  `SUPER_ADMIN`.

### R-AD-4 Mutation safety `D`

Admin mutations run against live customer data, so they are held to a higher standard than customer
mutations:

| Property | Mechanism |
| --- | --- |
| Explicit confirmation for destructive or customer-affecting actions | UI requires confirmation; server requires the confirm flag |
| Idempotency | Retrying an admin action does not double-apply it |
| Reversibility where possible | Suspension is reversible; a price change is a new row, not an overwrite |
| Bounded scope | No bulk action touches an unbounded set of tenants in one call |
| Visible pending state | The UI disables the control while the mutation is in flight |
| Typed failure | A failed mutation reports why and can be retried |

### R-AD-5 Recoverable errors `S1`

The brief requires recoverable errors in the admin dashboard. Concretely: every failure in the
control plane offers a next step — retry, escalate, or acknowledge — rather than a dead end. An admin
who hits an error with no action available will work around the system, and the workaround will not
be audited.

### R-AD-6 Economics aggregates `D`

Platform-wide economics must not deanonymize a tenant. With a small customer base, a revenue chart
identifies a tenant by elimination. Minimum-cohort suppression applies (OD-TI-1); below the
threshold, values are suppressed rather than shown.

### R-AD-7 Undefined `X`

| Question | ID |
| --- | --- |
| Is `ADMIN` platform-scoped or organization-scoped? | OD-RB-1 — **also blocks the RLS matrix** |
| The per-action `ADMIN` vs `SUPER_ADMIN` matrix | OD-RB-2 |
| How the first `SUPER_ADMIN` is provisioned | OD-RB-3 |
| Whether `ADMIN` sees full or redacted payment metadata | OD-RL-2 |

OD-RB-1 is the highest-leverage open decision in the documentation set: a single answer unblocks the
admin policy text, the RLS matrix, and this action inventory's scope column.

## Security considerations

- **The control plane is the highest-value target in the product.** It can change access state, quota,
  price, and role. Its authorization is checked per request, never per session.
- **Audit completeness is the difference between an investigable incident and an unexplained one.**
  Including failed attempts matters: successful abuse is preceded by probing.
- **Append-only audit survives a compromised admin account.** An admin who can delete their own audit
  entries can act without trace.
- **Required reasons** convert an override into a reviewable decision.
- **Bounded bulk scope** prevents one mistaken action from affecting every tenant — the admin
  equivalent of failure isolation.
- **The first `SUPER_ADMIN` must not be provisioned by an endpoint** (OD-RB-3). A role-granting
  endpoint is a bootstrapping vulnerability; a migration or manual SQL step is not.

## Acceptance criteria

- [ ] Every mutating admin action requires an authorized server-side call and writes an audit entry.
- [ ] A `CUSTOMER` JWT calling any admin action is denied and the attempt is audited.
- [ ] `audit_logs` cannot be updated or deleted by any role, asserted by test.
- [ ] Any action changing access, quota, or entitlement requires a reason.
- [ ] A failed admin action returns a typed error with an available next step.
- [ ] An admin mutation shows a pending state and cannot be double-submitted.
- [ ] Economics aggregates suppress cohorts below the minimum size.
- [ ] Retrying a completed admin action does not double-apply it.

## Related skills

- [`ux-heuristics`](../SKILLS.md#ux-heuristics) — confirmation, visibility, and error recovery.
- [`release-it`](../SKILLS.md#release-it) — operability and recoverable errors.
- [`system-design`](../SKILLS.md#system-design) — separating the control plane from the data plane.
- [`clean-architecture`](../SKILLS.md#clean-architecture) — admin actions as application services.

## Open decisions

- **OD-RB-1** `ADMIN` scope. **Blocks the RLS matrix and this inventory's scope column.**
- **OD-RB-2** The per-action permission matrix.
- **OD-RB-3** First `SUPER_ADMIN` provisioning.
- **OD-TI-1** Minimum cohort size for aggregates.
- **OD-AD-1** Whether admin actions are one function per action or one with an action parameter.
  Recommend per-action ([OD-BE-4](../01-architecture/backend.md#open-decisions)).
