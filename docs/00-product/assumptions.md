# Assumptions Register

## Purpose

Record every position this rebuild has taken **without** a source that fully authorizes it, so that
each one is visible, reviewable, and reversible. This document exists to keep assumptions out of the
rule register: an assumption that is written down as a rule stops being questionable.

## Scope

In scope: provisional positions taken to let design work proceed, what each affects, and what would
invalidate it. Out of scope: rules grounded in the brief (those live in
[business-rules](business-rules.md) tagged `S1`) and unknowns (those live in
[legacy-audit-gap-register](legacy-audit-gap-register.md) tagged `X`).

## Source of truth

- `S1` Strategic brief — where an assumption merely extends or operationalizes a briefed rule.
- `D` This rebuild — where the assumption is a design position with no briefed basis.
- No assumption in this file is grounded in `S2` or `S3`, because neither is available.

## Requirements

### R-AS-1 What an assumption is, and is not `S1`

| An assumption **is** | An assumption **is not** |
| --- | --- |
| A provisional position taken to unblock design | A business rule |
| Reversible at zero cost while unimplemented | A commitment |
| Tagged and listed here | Something inferred silently in code |
| Validated or rejected by the product owner | Self-approved |

Every assumption below has status `PROPOSED` unless explicitly approved. **Nothing here is approved
by default.** An assumption that is implemented without approval becomes an undocumented business
decision, which is precisely the failure this register prevents.

### R-AS-2 Scope limit on assumptions `S1`

Assumptions may cover **architectural and procedural** positions. They may **not** cover:

- Pricing, quotas, or entitlement contents
- Score component definitions or weights
- Deduplication identity or material-update semantics
- Payment lifecycle behaviour — grace periods, dunning, proration, refund and dispute effects
- Notification or delivery policy

These are product economics and product behaviour. The brief forbids inventing them, and an
"assumption" is invention with extra paperwork. They stay in
[legacy-audit-gap-register](legacy-audit-gap-register.md) as `BLOCKED`.

### R-AS-3 Register

| ID | Assumption | Basis | Affects | Invalidated by | Status |
| --- | --- | --- | --- | --- | --- |
| **A-01** | The provisional product source of truth is (1) the strategic brief and (2) this v2 documentation baseline. **No legacy PRD exists in this workspace and none has been read.** | Verified: no PRD-named file exists anywhere on the filesystem | Every document in `docs/**` | The legacy source being supplied | PROPOSED |
| **A-02** | `myelektra/myelektra-signal-saas` is **unresolved, not unrecoverable**. No determination of permanence has been made. | Owner instruction | The gap register's status, and every `X` tag | A written statement that it is unrecoverable | PROPOSED |
| **A-03** | Monthly billing uses PayPal's **subscription** capability rather than repeated one-time orders. | Brief specifies "monthly subscription" and the ledger carries `provider_subscription_id`; the exact API is unverified (`S4`) | PayPal integration design | Provider documentation review — OD-PP-1 | PROPOSED |
| **A-04** | All cron schedules run in **UTC**. | Brief gives cron expressions without a timezone; UTC avoids DST-induced duplicate and skipped runs | `signal-daily-dispatch`, `payment-reconciliation` | A stated local-time requirement | PROPOSED |
| **A-05** | The organization — not the user — is the billing subject and the holder of access state. | Brief's conceptual model hangs subscriptions and payments off `organizations` | Schema, RLS, access-state resolution | A product statement that billing is per user | PROPOSED |
| **A-06** | A user may belong to more than one organization; the resolution flow picks a single active organization per session. | The brief does not say; the schema permits it | Auth resolution, membership UX | A product statement that membership is 1:1 — OD-TI-2 | PROPOSED |
| **A-07** | Prices live in the `packages` table and are the sole authority for what is charged. | Extends the briefed rule that the Edge Function resolves price server-side | Checkout, homepage display, price changes | A requirement that prices are set in the PayPal console only | PROPOSED |
| **A-08** | Cost policy is enforced by **mechanism** (per-run ceilings, per-job token budgets, attribution of every paid call to a job and an organization). The **numeric ceilings are not assumed** and remain blocked. | Brief mandates bounded batches; the numbers are not given | Pipeline cost control, admin Economics | Product owner supplying the numbers — OD-CO-2 | PROPOSED |
| **A-09** | The `score_components` column is validated to contain exactly the six briefed keys, so a published Signal can never be missing one the UI must render. | Extends the briefed requirement that all six components are present | Schema, Signal detail UI | A decision to use six typed columns — OD-DB-1 | PROPOSED |
| **A-10** | Cross-tenant access attempts return `404`, not `403`. | The brief prohibits cross-tenant access but does not specify the status code; `404` avoids an existence oracle | Every endpoint, the denial contract | A product or support requirement to distinguish the two | PROPOSED |
| **A-11** | Audit logging covers failed privileged attempts as well as successful ones. | Extends the briefed rule that privileged mutations are audited; failed attempts are the probing signal | `audit_logs`, admin Audit Log surface | A decision that failures are noise | PROPOSED |
| **A-12** | Repository layout is `apps/web`, `packages/domain`, `packages/contracts`, `packages/adapters`, `supabase/functions`, with the dependency rule enforced by lint rather than convention. | The brief requires business rules stay out of React but names no layout | Phase 1 scaffolding, CI boundary check | An owner preference — OD-SA-1 | **APPROVED** |
| **A-13** | The daily run is drained by a separate worker invocation rather than one long dispatcher call. | Extends the briefed rule that the daily process must not be one long unresumable function | Cron design, adds a third schedule | An owner decision — OD-JB-2 | PROPOSED |
| **A-14** | Where a UI state is unspecified, the eight briefed states are the complete set; no additional states are invented. | Brief enumerates exactly eight | Every route in Phase 5 and 6 | A design review finding a ninth | PROPOSED |

**A-12 was approved on 2026-08-29**, on the grounds that the layout preserves the intended dependency
direction and separates frontend, domain rules, contracts, adapters, and Supabase server functions.
That clears the R-AS-4 block on Phase 1B. See
[foundation-plan R-FN-15](../01-architecture/foundation-plan.md#r-fn-15-a-12-approval-s1).

The approval also **amends the boundary rule** written under A-12. "`apps/web` imports `contracts`
only" was too strict to be workable — the SPA must reach Supabase Auth and Edge Functions. The
corrected boundary permits exactly one browser-safe API module and forbids every privileged import;
see [foundation-plan R-FN-2](../01-architecture/foundation-plan.md#r-fn-2-frontend--backend-boundary-s1).

Note that the A-12 row above originally listed only three of the five locations. It is corrected here
so the approved record matches the approved layout.

### R-AS-4 Promotion and rejection `D`

| Transition | Requirement |
| --- | --- |
| `PROPOSED → APPROVED` | The product owner approves in writing. The assumption either becomes an `S1`-equivalent rule in [business-rules](business-rules.md) or a settled design decision, and this row records the approval. |
| `PROPOSED → REJECTED` | The dependent design is revised in the same commit. No rejected assumption may survive in code. |
| `PROPOSED → SUPERSEDED` | The legacy source answered the question. The answer replaces the assumption and the gap register is updated. |
| Any → implemented | **Prohibited without approval.** Implementation of an unapproved assumption is a defect. |

### R-AS-5 Interaction with the other registers `D`

```
S1  → business-rules.md          (grounded, normative)
D   → assumptions.md             (proposed, provisional)  ← this file
X   → legacy-audit-gap-register.md (unknown, blocked)
OD  → open-decisions.md          (the queue that resolves D and X)
```

An item may move along `X → D → S1` as it becomes known, proposed, then approved. It may not skip a
stage: an unknown does not become a rule without passing through a reviewed proposal.

## Security considerations

- **The register is a security control, not bureaucracy.** The most dangerous assumption in a payment
  system is the one nobody wrote down — a grace period, a rounding rule, a currency conversion that
  someone "just handled".
- **R-AS-2 is the load-bearing rule.** Allowing assumptions about pricing or payment lifecycle would
  convert the brief's prohibition on invention into a formality.
- **A-02 has a safety purpose.** Declaring the legacy repository unrecoverable would license
  re-specifying 18 blocked targets from imagination. Keeping it open keeps that door closed.
- **A-10 and A-11 are security-relevant assumptions** and are flagged as such: one closes an
  enumeration oracle, the other preserves attack-detection signal.
- **A-08 explicitly refuses to assume numbers.** A cost ceiling invented here would look authoritative
  the moment it appeared in code.

## Acceptance criteria

- [ ] Every assumption has an ID, a basis, an affected area, an invalidation condition, and a status.
- [ ] No assumption covers pricing, quotas, entitlements, scoring definitions, deduplication
      semantics, or payment lifecycle behaviour — verified against R-AS-2.
- [ ] No assumption is implemented before it is approved.
- [ ] Every assumption tagged `PROPOSED` appears in [open-decisions](open-decisions.md).
- [ ] Approving or rejecting an assumption updates this file in the same commit.
- [ ] A-01 and A-02 remain accurate: no legacy PRD is cited anywhere in `docs/**` as if it had been
      read.

## Related skills

- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — write down the assumption, then test it.
- [`clean-architecture`](../SKILLS.md#clean-architecture) — provisional positions become interfaces,
  not implementations.
- [`release-it`](../SKILLS.md#release-it) — assumptions are risks with invalidation triggers.

## Open decisions

Every `PROPOSED` row above is an open decision and is indexed in
[open-decisions](open-decisions.md). The two that gate the most work:

- **A-01** — if a legacy PRD is in fact supplied, the entire baseline must be reconciled against it.
- **A-03** — the PayPal subscription assumption gates Phase 7 and is resolved by reading provider
  documentation, which needs no legacy source.
