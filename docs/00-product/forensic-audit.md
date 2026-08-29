# Forensic Audit — Legacy Repository `myelektra-signal-saas`

## Purpose

Record the forensic audit of the legacy repository, which was mandated as the first Phase 0
deliverable, and record precisely what was and was not possible.

## Scope

In scope: the audit attempt, the evidence for its outcome, and the resulting gap register.
Out of scope: any reconstruction of legacy behaviour from memory or inference.

## Source of truth

| Source | Expected location | Actual state (verified this session) |
| --- | --- | --- |
| Legacy repository filesystem | `/home/user/myelektra-signal-saas` | **Does not exist.** `ls /home/user` returns only `myelektra-signal-v2`. A filesystem-wide `find / -iname "*myelektra*"` returns exactly one hit: `/home/user/myelektra-signal-v2`. |
| Legacy documentation | `docs/product/*.md`, `DESIGN.md`, `AGENTS.md`, `SKILLS.md`, `docs/contracts/`, `docs/market-intelligence/`, `docs/architecture/` | **None present.** Targeted searches for `00-prd.md`, `paypal-migration-strategy.md`, `DESIGN.md`, and any `docs/product` directory all returned zero results. |
| Legacy repository on GitHub | `myelektra/myelektra-signal-saas` | **Not resolvable.** `gh repo view myelektra/myelektra-signal-saas` returned `Could not resolve to a Repository`. `gh repo list myelektra` returns four repositories: `myelektra-signal-v2`, `prospeo-key-rotation-proxy`, `glm-weebly-theme`, `myelektra-platform`. None is the legacy Signal repository. |
| Strategic brief (this engagement) | provided in the task prompt | **In hand. Authoritative.** |

## Requirements

What the audit was required to produce, and what this document must do in its absence.

| ID | Requirement | Status |
| --- | --- | --- |
| R-FA-1 | Read the legacy documentation and source code before any design work. | **Not met** — source absent |
| R-FA-2 | Extract the 20 enumerated business-rule domains, whether or not they were documented. | **Partially met** — 3 answered, 8 partial, 9 blocked; see the gap register |
| R-FA-3 | Carry only business rules, never legacy implementation. | Met by construction — nothing was available to carry |
| R-FA-4 | Record undocumented rules found in source into [business-rules](business-rules.md). | **Not met** — no source |
| R-FA-5 | List conflicts between documents and resolve them by the stated precedence. | Partially met — precedence recorded; only one conflict is visible |
| R-FA-6 | Never assert legacy behaviour that was not read. | **Met** — this is the reason the audit is reported as blocked rather than approximated |
| R-FA-7 | Prove the audit's outcome with the commands and outputs that establish it. | Met — see the table above |
| R-FA-8 | Supersede this document when the source becomes available, rather than appending to it. | Pending |

R-FA-6 is the requirement that shaped this document. The alternative — writing plausible rules and
labelling them as audited — would have produced a more complete-looking Phase 0 and a system built on
invented pricing, quotas, and payment behaviour, which the brief forbids explicitly.

## Result

**The forensic audit could not be performed.** Deliverable 1 of Phase 0 is **BLOCKED**, not
delivered. This document is the audit of record for that fact.

The legacy source is **unresolved, not unrecoverable**. No determination of permanence has been made,
and none is implied here. The audit remains open and will be run when the source is supplied
([assumption A-02](assumptions.md)).

This is stated plainly rather than worked around because the entire point of the exercise is to
extract *undocumented* business rules. Those rules exist only inside files that are not in this
workspace. Any statement about them written here would be invention, and the brief explicitly
forbids inventing pricing, quotas, or payment lifecycle behaviour.

## Consequences

Everything in this documentation set is therefore grounded in exactly one source: the strategic
brief. A provenance tag appears on every requirement so a reader can always tell which is which:

| Tag | Meaning | Available here |
| --- | --- | --- |
| `S1` | Strategic brief for the v2 rebuild (2026-08-29) | Yes — in hand |
| `S2` | Legacy documentation (`docs/product/*`, `DESIGN.md`, `AGENTS.md`, `SKILLS.md`, `docs/contracts/*`) | **No** |
| `S3` | Legacy source code | **No** |
| `S4` | Third-party provider documentation (Supabase, PayPal, OpenAI) | Not fetched; must be verified before implementation |
| `D` | Design decision proposed by this rebuild — needs approval before implementation | Yes |
| `X` | Blocked. Must not be invented. | — |

## Gap register

The itemized status of all 20 mandated audit targets now lives in its own file, which is the single
authoritative register:

**→ [legacy-audit-gap-register.md](legacy-audit-gap-register.md)**

Summary: **2 answered · 9 partially answered · 9 fully blocked.** The three blockers that gate the
most downstream work are package quotas and entitlements (**B-2**), the signal type taxonomy and
score-component definitions (**B-3**), and deduplication identity and material-update semantics
(**B-4**).

This document intentionally does not reproduce that table. Two copies of a 20-row status table drift
apart, and a gap register that disagrees with itself is worse than none.

## Conflict list

The brief instructed that conflicts between documents be listed and resolved by a fixed precedence.
No inter-document conflicts can be enumerated, because only one document exists. The precedence
rules are nonetheless recorded so they bind as soon as more sources appear:

1. Supabase is the database and backend platform.
2. PayPal replaces Mayar as payment provider.
3. Supabase Cron is the scheduler for the daily Signal run.
4. Vercel hosts the frontend only.
5. No Mayar customers require migration.
6. No legacy production payment data must be preserved.

One conflict *is* visible and is recorded here: the brief names `Stripe legacy path` among the
prohibited items while also naming PayPal as the sole customer checkout provider. Resolution under
rule 2 — PayPal only; Stripe is not implemented at all, in any path. See
[legacy-carryover-decisions](../01-architecture/legacy-carryover-decisions.md).

## Security considerations

- The absence of the legacy repository is itself a security-relevant fact: no legacy secret, key,
  or credential has been read, copied, or reproduced into this repository. The secret-exposure
  surface of v2 starts clean.
- Any future ingestion of the legacy repository must be read-only and outside the v2 working tree,
  so that legacy code cannot be copied in by accident.

## Acceptance criteria

- [x] The absence of the legacy source is documented with the commands and outputs that prove it.
- [x] Every mandated audit target is individually statused rather than silently skipped.
- [x] No legacy business rule is asserted anywhere in `docs/**` without an `S1` grounding.
- [x] The register states that the legacy source is **not** declared unrecoverable.
- [ ] Audit is re-run and this document is superseded once the legacy source is supplied.

## Related skills

- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — do not ship knowledge you did not verify.
- [`release-it`](../SKILLS.md#release-it) — treat unknowns as risks with owners, not as blanks.

## Open decisions

- **OD-FA-1 (blocker)** Supply `/home/user/myelektra-signal-saas`, or a read-only export of it, or
  confirm in writing that it is unrecoverable. Everything tagged `X` stays blocked until this is
  resolved. See [open-decisions](open-decisions.md).
- **OD-FA-2** If the legacy repository is genuinely unrecoverable, decide whether the `X` items are
  re-specified from scratch as new product decisions (which is legitimate) or left unimplemented
  (which shrinks v2's scope). This is a product-owner decision, not an engineering one.
