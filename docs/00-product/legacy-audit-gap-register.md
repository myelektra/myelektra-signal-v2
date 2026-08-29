# Legacy Audit Gap Register

## Purpose

The authoritative, itemized register of everything the mandated forensic audit was supposed to
extract from `myelektra/myelektra-signal-saas` and could not. This is the single place a reader goes
to answer "what do we not know, and what is that blocking?"

## Scope

In scope: source-resolution evidence, the 20 mandated audit targets and their status, the downstream
blocking effect of each, and the register's maintenance rules. Out of scope: the audit narrative
([forensic-audit](forensic-audit.md)), which this register supersedes on detail, and the decision
queue ([open-decisions](open-decisions.md)).

## Source of truth

- `S1` Strategic brief — the list of 20 audit targets and the instruction not to invent missing
  legacy business rules.
- Workspace state **verified this session** (2026-08-29). Commands and outputs are reproduced in
  R-GAP-1 so the finding can be re-checked rather than trusted.
- `S2`/`S3` Legacy documentation and source — **not available**.

## Requirements

### R-GAP-1 Source resolution record `S1`

The legacy source **could not be resolved in this workspace**. Evidence, re-run this session:

| # | Check | Command | Result |
| --- | --- | --- | --- |
| 1 | Expected path | `ls -la /home/user/` | Contains only dotfiles, `.npm`, and `myelektra-signal-v2`. No `myelektra-signal-saas`. |
| 2 | Filesystem-wide, name-matched | `find / -maxdepth 7 -iname "*myelektra*"` | Exactly one hit: `/home/user/myelektra-signal-v2` |
| 3 | Filesystem-wide, legacy name | `find / -maxdepth 8 -iname "*signal-saas*"` | **0 hits** |
| 4 | Legacy docs by name | `find / -maxdepth 9 \( -iname "*prd*" -o -iname "DESIGN.md" -o -iname "AGENTS.md" \)` | **0 hits** |
| 5 | Only `SKILLS.md` on the box | `find / -maxdepth 9 -iname "SKILLS.md"` | `/home/user/myelektra-signal-v2/docs/SKILLS.md` — authored during this rebuild, not the legacy file |
| 6 | GitHub | `gh repo view myelektra/myelektra-signal-saas` | `Could not resolve to a Repository` |
| 7 | GitHub, org listing | `gh repo list myelektra` | `myelektra-signal-v2`, `prospeo-key-rotation-proxy`, `glm-weebly-theme`, `myelektra-platform` — no legacy Signal repository |

**Status: BLOCKED — awaiting source.**

This is explicitly **not** a finding that the repository is unrecoverable. That determination is not
mine to make and has not been made. The register stays open until the source is supplied or the
product owner states otherwise in writing.

### R-GAP-2 Corollary: no PRDs exist in this workspace `S1`

The instruction to treat "the documentation and PRDs already available in the current workspace" as
the provisional product source of truth cannot be followed literally, because checks 3–5 above
return nothing. **There are no PRDs in this workspace.** The only documentation present is the v2
baseline authored during this rebuild, whose own source of truth is the strategic brief.

The provisional source of truth is therefore recorded as:

```
1. The strategic brief for the v2 rebuild (2026-08-29)   — tag S1
2. This v2 documentation baseline, as derived from it     — tags D and X
```

and **not** any legacy PRD. This is recorded as [assumption A-01](assumptions.md) so that nobody later
cites a PRD that was never read.

### R-GAP-3 The 20 mandated audit targets

| # | Target | Status | What is known (`S1`) | What remains unknown | Blocks |
| --- | --- | --- | --- | --- | --- |
| 1 | Signal score formula | **PARTIAL** | Six components, exact weights, four bands | Per-component input definitions, decay curves, tie-breaking, rounding | Phase 3 — **B-3** |
| 2 | Signal classification | **BLOCKED** | The field `signal_type` exists and is required | The entire taxonomy | Phase 3 — **B-3** |
| 3 | Signal lifecycle | **PARTIAL** | Publication gate; "no evidence, no published Signal" | State machine from discovery to publish/discard; rejected-candidate retention | Phase 3 |
| 4 | Evidence requirements | **PARTIAL** | Required fields on a published Signal; verification is privileged | Minimum source count, authority grading, retraction handling, retention | Phase 3 |
| 5 | Validation rules | **BLOCKED** | Stage names and order | Rejection criteria, taxonomy, retry-on-invalid behaviour | Phase 3 |
| 6 | Dedup / material update | **BLOCKED** | It is a named pipeline stage; scope is the tenant | Identity key, similarity threshold, material-update definition | Phase 3 — **B-4** |
| 7 | Monitoring frequency | **PARTIAL** | Daily dispatch `0 3 * * *` UTC | Per-account cadence, re-check intervals | Phase 4 |
| 8 | Package limits | **BLOCKED** | Three plans at $19/$49/$99 USD monthly | Every quota: accounts, Signals/day, seats, contacts, opportunities | Phase 2 schema, Phase 5, Phase 7 — **B-2** |
| 9 | Usage / quota behaviour | **BLOCKED** | A `usage` table exists | Hard stop vs soft warn vs overage; rollover; mid-cycle change | Phase 2, Phase 5 |
| 10 | Customer access states | **ANSWERED** | Five states, exact names | `SUSPENDED` triggers and reversibility; onboarding completion criteria | Phase 2 (partial) |
| 11 | Subscription states | **BLOCKED** | The PayPal-side flow | Provider-state → internal-state mapping; dunning; grace period | Phase 7 |
| 12 | Entitlement rules | **BLOCKED** | Entitlement follows settlement | What each plan entitles beyond price | Phase 2, Phase 5 — **B-2** |
| 13 | Admin permissions | **PARTIAL** | Three role names | `ADMIN` scope; per-action matrix; first `SUPER_ADMIN` provisioning | Phase 2 RLS, Phase 6 |
| 14 | Report / delivery | **BLOCKED** | Delivery is the final stage; attempts are recorded | Channels, schedule, format, failure policy | Phase 4 |
| 15 | Notification rules | **BLOCKED** | A `notifications` table exists | Triggers, throttling, preferences | Phase 5 |
| 16 | Payment settlement | **PARTIAL** | End-to-end flow; provider-neutral ledger shape | Proration, partial capture, refund/dispute effect on access state | Phase 7 |
| 17 | Webhook idempotency | **PARTIAL** | Replay protection and idempotent settlement are mandated | Exact provider event identifiers — verify against provider docs (`S4`) | Phase 7 |
| 18 | RLS / tenant isolation | **ANSWERED** | The invariants and prohibitions | Whether legacy *violated* any of them (unknowable, and not needed for a clean build) | — |
| 19 | Security edge cases | **PARTIAL** | The full prohibition list | Legacy-specific incidents and near-misses that would inform the threat model | Phase 8 |
| 20 | Error / retry behaviour | **PARTIAL** | Job states, `attempt_count`, backoff, stale recovery | Concrete backoff parameters, max attempts, lease duration | Phase 4 |

**Totals: 2 answered · 9 partial · 9 blocked.**

### R-GAP-4 Blocking effect by phase `D`

| Phase | Can it proceed? | Why |
| --- | --- | --- |
| 0 Documentation | **Yes** | Complete as a baseline; this register is its honest edge |
| 1 Foundation | **Yes** | Toolchain, Vercel, Supabase, lint/test/build, CI depend on no legacy rule |
| 2 Database / Auth / Tenant | **Partially** | Schema, RLS, and isolation are fully specified. `packages.limits`, `usage` metrics, and the `ADMIN` scope policy are not |
| 3 Signal domain | **No** | Scoring components (B-3), taxonomy (B-3), deduplication identity (B-4), and rejection taxonomy are all blocked. The interfaces and the publication gate can be built; the rules inside them cannot |
| 4 Jobs / Cron | **Yes, mostly** | Lifecycle, leases, idempotency, and recovery are specified. Concrete backoff parameters are `D` and need approval, not legacy source |
| 5 Homepage / Customer dashboard | **Partially** | Homepage and the six-section Signal detail are fully specified. Usage and quota surfaces are blocked on B-2. Visual work is blocked on the missing Clean Clay definition |
| 6 Admin dashboard | **Partially** | Action Required and audit visibility are specified. The permission matrix is blocked on `ADMIN` scope |
| 7 PayPal | **No** | Provider API surface unverified, and renewal/cancellation/refund behaviour is undefined |
| 8 Production readiness | **No** | Depends on all of the above |

### R-GAP-5 Maintenance rules `D`

| ID | Rule |
| --- | --- |
| R-GAP-5.1 | This file is the single gap register. [forensic-audit](forensic-audit.md) summarizes and links here; it does not duplicate the table. |
| R-GAP-5.2 | A target moves out of `BLOCKED`/`PARTIAL` only when its answer has a named source. "It seemed reasonable" is not a source. |
| R-GAP-5.3 | Closing a target updates this file, [business-rules](business-rules.md), and [open-decisions](open-decisions.md) in the same commit. |
| R-GAP-5.4 | A blocked target is never filled by inference during implementation. If code needs the value, the value is requested, not guessed. |
| R-GAP-5.5 | The register is re-run against the source when the source appears, and this file is superseded rather than appended to. |
| R-GAP-5.6 | Status is one of `ANSWERED`, `PARTIAL`, `BLOCKED`. There is no `ASSUMED` status — an assumption is recorded in [assumptions](assumptions.md), never smuggled in as an answer. |

## Security considerations

- **Nothing from the legacy repository has been read, copied, or reproduced.** No legacy secret,
  credential, or code has entered this repository. The v2 secret surface starts clean, and the
  prohibition on reusing legacy credentials stands
  ([secrets](../07-security/secrets.md)).
- **An unmarked gap is the real risk.** A `BLOCKED` item that gets quietly filled during
  implementation becomes an unreviewed business decision with financial consequences — a wrong quota
  or a wrong grace period is a revenue and trust event, not a cosmetic bug.
- **The register is itself a control.** It is what allows Phases 1, 2, and 4 to proceed safely: the
  work is scoped to what is actually specified, and the rest is visibly fenced off.
- **No production-readiness claim** may be made while any target is `BLOCKED`
  ([production-checklist](../10-testing/production-checklist.md)).

## Acceptance criteria

- [x] The legacy source's absence is recorded with the commands and outputs that establish it.
- [x] All 20 mandated targets are individually statused; none is silently skipped.
- [x] Each target names what is known, what is unknown, and what it blocks.
- [x] The register states that the repository is **not** declared unrecoverable.
- [x] No legacy business rule is asserted anywhere in `docs/**` without an `S1` grounding.
- [ ] Every `BLOCKED` target is closed or explicitly re-scoped out before its phase begins.
- [ ] Re-run and supersede this file when the legacy source becomes available.

## Related skills

- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — track unknowns explicitly instead of
  living with them.
- [`release-it`](../SKILLS.md#release-it) — a gap register is a risk register with owners.
- [`clean-architecture`](../SKILLS.md#clean-architecture) — blocked rules become interfaces awaiting
  a decision, not guessed implementations.

## Open decisions

- **B-1 / OD-FA-1** Supply the legacy source. Until then every `BLOCKED` row above stays blocked.
- **OD-GAP-1** If the source never arrives, the `BLOCKED` items must be re-specified as *new* product
  decisions by the product owner. That is a legitimate path, but it is a product decision, not an
  engineering one, and it has not been taken.
