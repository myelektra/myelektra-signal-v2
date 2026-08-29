# Admin Dashboard

## Purpose

Specify the operator-facing surfaces: what each shows, which one is prioritized, and how the UI makes
production failures recoverable rather than merely visible.

## Scope

In scope: the surface inventory, prioritization, error recovery, and mutation safety in the UI. Out
of scope: the server-side control plane ([admin-control-plane](../08-admin/admin-control-plane.md))
and the design system (OD-LC-2).

## Source of truth

- `S1` Strategic brief — the nine admin surfaces, the instruction to prioritize the Action Required
  queue, and the requirements for recoverable errors, audit visibility, and safe mutation states.
- `S2` Legacy `docs/product/prd-admin-dashboard.md` and `docs/ADMIN-DASHBOARD-UI-CODE-REVIEW.md` —
  **not available**.
- `D` Design decisions proposed here.

## Requirements

### R-AD-1 Surfaces `S1`

| Surface | Shows |
| --- | --- |
| System health | Did today's run happen? Queue depth, job states, stale leases, reconciliation lag |
| **Action Required** | The queue of things needing a human, each with an available action |
| Customers | Organizations, memberships, access states, subscription states |
| Daily Reports | Runs and their outcomes, per organization |
| Usage & Quotas | Counters against limits, per organization and period |
| Packages | The catalog, prices, active state |
| Economics | Revenue and cost aggregates |
| Audit Log | Who did what, when, with before/after state |
| Settings | Platform configuration |

### R-AD-2 Priority `S1`

**Action Required is built first.** It is the surface that converts a customer-visible failure into a
resolved one, so its absence means every failure is resolved by hand through a database console —
unaudited and error-prone.

Each queue item carries:

| Element | Why |
| --- | --- |
| What failed, in plain language | An operator should not need to read a stack trace |
| Which customer is affected | Determines urgency |
| When it started and how many attempts have run | Distinguishes transient from persistent |
| The available actions — retry, resolve, acknowledge | A failure with no action is a dead end |
| A link to the underlying detail | For investigation, not for routine triage |

### R-AD-3 Recoverable errors `S1`

Every failure in the admin UI offers a next step. Rules:

- **No dead-end errors.** If the UI can show an error, it can show a retry, an escalation, or an
  acknowledge.
- **Retry actually retries.** A control that re-renders without re-invoking is worse than none,
  because it teaches the operator that retrying does not work.
- **Errors are typed and stable**, so an operator learns what `job_lease_expired` means and acts
  without re-reading documentation.
- **Partial data is labelled.** A health view where one query failed says so, rather than showing the
  successful parts as if they were the whole picture.

An admin who hits an unactionable error will work around the system, and the workaround will not be
in the audit log.

### R-AD-4 Audit visibility `S1`

The audit log is readable, filterable by actor, action, entity, and time, and shows before/after
state. It is **never writable from the UI** (BR-RB-05). Rules:

- Failed authorization attempts on admin actions are visible, because probing precedes abuse.
- Overrides that changed a customer's access, quota, or entitlement show the required reason
  ([admin-control-plane R-AD-3](../08-admin/admin-control-plane.md#r-ad-3-audit-s1)).
- The log renders as append-only: no edit or delete affordance exists, so the UI does not imply a
  capability that is correctly denied.

### R-AD-5 Safe mutation states `S1`

Admin mutations touch live customer data, so the UI holds them to a higher standard:

| State | Requirement |
| --- | --- |
| Idle | The action is clearly labelled with its consequence |
| Confirming | Destructive or customer-affecting actions require explicit confirmation |
| Pending | The control is disabled and progress is visible; double submission is impossible |
| Success | Confirmation names what changed, and the underlying data reflects it |
| Failed | The reason is shown and the action can be retried |
| Stale | If the underlying record changed since load, the mutation is refused rather than applied blind |

The stale case matters: two admins acting on the same customer concurrently must not silently
overwrite each other.

### R-AD-6 Economics `D`

Aggregates only, with minimum-cohort suppression (OD-TI-1). A revenue chart over a small customer
base deanonymizes by elimination. Below the threshold, values are suppressed and the suppression is
stated, not silently zeroed — a silent zero is a lie about the business.

### R-AD-7 Eight states `S1`

Every admin route implements all eight states per
[test-strategy R-TS-4](../10-testing/test-strategy.md#r-ts-4-state-variant-coverage-s1). Admin
surfaces are queried less often and cached longer, which makes the **stale** state more important
here than anywhere else in the product.

## Security considerations

- **The admin UI is the highest-value target.** It can change access state, quota, price, and role.
  Every action it offers must correspond to a server-side authorized call; a button that is hidden is
  not a control ([R-AU-5](../03-auth/authentication-authorization.md#r-au-5-enforcement-points-s1)).
- **Audit log is read-only in the UI**, matching the database. A UI that offered delete would invite
  an attempt and produce a confusing denial.
- **Aggregate suppression** prevents tenant deanonymization (T-19).
- **`last_error` and provider payloads may contain sensitive fragments.** They are admin-readable, but
  the UI should not render raw payloads by default — an admin screen shared over a screen-share is a
  leak channel.
- **Confirmation before customer-affecting actions** is a safety control, not a UX flourish: a
  mis-click that suspends a paying customer is a support incident.

## Acceptance criteria

- [ ] All nine surfaces exist and are reachable by an authorized admin.
- [ ] Action Required is implemented first and every item offers at least one working action.
- [ ] No error in the admin UI is a dead end; each offers retry, escalate, or acknowledge.
- [ ] Every retry control re-invokes the action, asserted by test.
- [ ] The audit log is readable and filterable, and offers no write affordance.
- [ ] Failed admin authorization attempts appear in the audit log.
- [ ] Every customer-affecting mutation requires confirmation and shows a pending state.
- [ ] A mutation against a record changed since load is refused rather than applied.
- [ ] Economics aggregates suppress cohorts below the minimum size and say so.
- [ ] Every admin route renders all eight states and passes axe at 360px, 768px, 1440px.

## Related skills

- [`ux-heuristics`](../SKILLS.md#ux-heuristics) — error recovery, confirmation, visibility of status.
- [`release-it`](../SKILLS.md#release-it) — operability; a dashboard you can act on.
- [`refactoring-ui`](../SKILLS.md#refactoring-ui) — information density without overload.
- [`design-everyday-things`](../SKILLS.md#design-everyday-things) — affordances under pressure.

## Open decisions

- **OD-LC-2** Clean Clay definition. **Blocks visual implementation.**
- **OD-RB-1** `ADMIN` scope, which determines what an admin can see at all.
- **OD-RB-2** The per-action permission matrix, which determines which controls render for which role.
- **OD-TI-1** Minimum cohort size for aggregates.
- **OD-AD-2** Whether Action Required items are grouped by customer, by failure type, or by severity.
- **OD-AD-3** Whether admin dashboards need real-time updates or polling suffices.
