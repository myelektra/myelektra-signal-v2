# Production Checklist

## Purpose

The gate between "the code works" and "this may serve customers". Every item has a status, and an
item that cannot be checked blocks the claim exactly as a failing one does.

## Scope

In scope: the release gate, the status vocabulary, and the current state. Out of scope: how each
check is implemented ([test-strategy](test-strategy.md)).

## Source of truth

- `S1` Strategic brief — the required command set, the nine required additional checks, and the rule
  that unavailable checks block the readiness claim.
- Verified environment state (this session): `bun 1.4.0`, `node v22.22.3`, `npm 10.9.8`; `bun.sh`
  unreachable; no Supabase project, Vercel project, or PayPal account configured in this workspace.

## Requirements

### R-PC-1 Status vocabulary `S1`

| Status | Meaning | Blocks readiness |
| --- | --- | --- |
| `passing` | Executed, result correct | No |
| `failing` | Executed, result wrong | **Yes** |
| `unavailable` | Could not be executed; blocker named | **Yes** |
| `not started` | Not yet implemented | **Yes** |

`unavailable` is not softer than `failing`. The brief is explicit: do not claim production readiness
if any required check is unavailable, and document the exact limitation.

### R-PC-2 Required commands `S1`

| Command | Status | Note |
| --- | --- | --- |
| `bun install` | not started | No `package.json` exists yet — Phase 1 |
| `bun tsc -b --noEmit` | not started | Phase 1 |
| `bun test` | not started | Phase 1 |
| `bun run lint` | not started | Phase 1 |
| `bun run build` | not started | Phase 1 |

`bun` itself is verified present (`1.4.0`) in this workspace, installed via npm because `bun.sh` is
unreachable. The toolchain is not the blocker; the absence of code is.

### R-PC-3 Required checks `S1`

| Check | Status | Blocker |
| --- | --- | --- |
| RLS verification | not started | Requires schema (Phase 2) |
| Tenant-isolation tests | not started | Requires schema (Phase 2) |
| Payment idempotency tests | not started | Requires PayPal integration (Phase 7) |
| Webhook replay tests | not started | Requires PayPal integration (Phase 7) |
| Access-state tests | not started | Requires auth (Phase 2) |
| Cron/job recovery tests | not started | Requires jobs (Phase 4) |
| Accessibility checks | not started | Requires UI (Phase 5) |
| Mobile visual checks | not started | Requires UI (Phase 5) |
| Secret exposure scan | not started | Requires a build (Phase 1) |

### R-PC-4 Security gates `S1`

From [security-model R-SM-1](../07-security/security-model.md#r-sm-1-mandated-completion-criteria-s1).
All fourteen are currently `not started`; each becomes verifiable at the phase noted.

### R-PC-5 Non-technical gates

| Gate | Status | Blocker |
| --- | --- | --- |
| Forensic audit complete | **unavailable** | The legacy repository is absent — **B-1** |
| Package quotas decided | **unavailable** | Product decision — **B-2** |
| Score component definitions decided | **unavailable** | Product decision — **B-3** |
| Deduplication semantics decided | **unavailable** | Product decision — **B-4** |
| PayPal API surface verified | **unavailable** | Provider documentation review — **OD-PP-1** |
| Clean Clay design system available | **unavailable** | Legacy `DESIGN.md` absent — **OD-LC-2** |
| Rate limiting decided | **unavailable** | **OD-SM-4**, `High` residual in the threat model |
| `ADMIN` scope decided | **unavailable** | **OD-RB-1** — blocks the RLS matrix |

### R-PC-6 Release sequence `D`

Per [deployment R-DP-4](../01-architecture/deployment.md#r-dp-4-release-sequence-d): CI green →
migrations → functions → cron verified → SPA → smoke → payment smoke. Live payment cutover follows
[paypal R-PP-9](../05-billing/paypal.md#r-pp-9-live-verification-d) and is a controlled event.

### R-PC-7 Rollback readiness `D`

| Layer | Ready |
| --- | --- |
| SPA rollback to previous Vercel deployment | Verify in staging before launch |
| Function rollback by redeploy | Verify in staging |
| Database: forward-only, expand-then-contract | Enforced by migration review |
| Cron disable via `cron.unschedule` | Verify in staging |
| PayPal: revert to a disabled-checkout state | **Must be tested.** A live payment system with no kill switch is not operable |

The PayPal kill switch deserves emphasis: if live checkout misbehaves, the first action must be
stopping new checkouts, and that action must have been practised.

## Current state

**Phase 0 status: `READY_FOR_APPROVAL`.**

The documentation baseline passed its final correctness pass, including the correction that RLS is
row-level and cannot protect individual columns — column protection is delivered by `CHECK`
constraints, column `REVOKE`, immutability triggers, and server-side RPCs.

**Not production ready**, and Phase 0 approval does not change that: no code, schema, or migration
exists, and five blockers remain.

The honest summary:

- Phase 0 documentation baseline is written, with every requirement tagged by provenance.
- The forensic audit **could not be performed** — the legacy repository is absent from this workspace
  and does not resolve on GitHub. See [forensic-audit](../00-product/forensic-audit.md).
- No code, schema, migration, or configuration exists yet.
- Five blockers (B-1 … B-5) must clear before Phases 2, 3, 5, and 7 can produce correct work.
- No claim of production readiness is made or implied anywhere in this repository.

## Security considerations

- **`unavailable` blocking readiness is the point.** A checklist where unavailable items are quietly
  skipped is a document that manufactures confidence.
- **The kill switch must be tested**, not just designed.
- **Rollback readiness is a security property**: a release that cannot be reversed turns a defect
  into an incident with no exit.
- **No readiness claim while B-1 stands**, because the forensic audit is what would have surfaced
  undocumented security-relevant behaviour in the legacy system.

## Acceptance criteria

- [ ] Every item above has a status, and every `unavailable` names its blocker.
- [ ] All five R-PC-2 commands pass in CI on a clean checkout.
- [ ] All nine R-PC-3 checks are implemented and `passing`.
- [ ] All fourteen security gates are `passing`.
- [ ] B-1 … B-5 are resolved or explicitly accepted in writing by the product owner.
- [ ] Rollback and the PayPal kill switch have been rehearsed in staging.
- [ ] This file is updated in the same commit as any status change.

## Related skills

- [`release-it`](../SKILLS.md#release-it) — the gate, the rollback, and the honest status report.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — a limitation stated is a limitation managed.

## Open decisions

- **OD-PC-1** Who signs off on an explicitly accepted `unavailable` item. Recommend the product owner
  in writing, recorded here.
- **OD-PC-2** Whether a staging dress rehearsal is mandatory before live payment cutover. Recommend
  yes; it is the only way R-PC-7 becomes verified rather than assumed.
