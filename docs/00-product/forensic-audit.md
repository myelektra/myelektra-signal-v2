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

## Gap register — the 20 mandated audit targets

Status of each item the brief asked the audit to extract. `Blocked` means the answer cannot be
produced without the legacy repository.

| # | Audit target | Status | Where it stands |
| --- | --- | --- | --- |
| 1 | Signal score formula | **Partially answered** | Weights and bands are fixed by the brief and captured in [scoring](../04-signals/scoring.md). Per-component input definitions, tie-breaking, and rounding are `X`. |
| 2 | Signal classification | **Blocked** | The signal *type* taxonomy is not in the brief. `X`. |
| 3 | Signal lifecycle | **Partially answered** | Publication gate ("no evidence, no published Signal") is `S1`. State machine between discovery and delivery is `X`. |
| 4 | Evidence requirements | **Partially answered** | Required fields for a published Signal are enumerated in the brief. Verification thresholds and the definition of "verified" are `X`. |
| 5 | Validation rules | **Blocked** | Structured-validation criteria, rejection reasons, and retry-on-invalid behaviour are `X`. |
| 6 | Deduplication / material update rules | **Blocked** | Identity keys, similarity thresholds, and "same event, new evidence" handling are `X`. |
| 7 | Monitoring frequency | **Partially answered** | Daily dispatch at `0 3 * * *` is `S1`. Per-account cadence and re-check intervals are `X`. |
| 8 | Package limits | **Blocked** | Plan *names and prices* are `S1` ($19 / $49 / $99). Per-plan quotas — accounts monitored, Signals per day, seats, contacts — are **not** in the brief and must not be invented. `X`. |
| 9 | Usage / quota behaviour | **Blocked** | Enforcement (hard stop vs soft warn), rollover, and mid-cycle upgrade effects are `X`. |
| 10 | Customer access states | **Answered** | The five states and their names are `S1`; see [authentication-authorization](../03-auth/authentication-authorization.md). Transition triggers for `SUSPENDED` are `X`. |
| 11 | Subscription states | **Blocked** | Mapping from PayPal subscription state to internal state is `X`; only the PayPal-side flow is `S1`. |
| 12 | Entitlement rules | **Blocked** | What each plan entitles beyond the price point is `X`. |
| 13 | Admin permissions | **Partially answered** | Role names (`CUSTOMER`, `ADMIN`, `SUPER_ADMIN`) are `S1`. Per-action permission matrix is `X`. |
| 14 | Report / delivery behavior | **Blocked** | Channel selection, schedule, format, and failure policy are `X`. Tables are named in the brief; behaviour is not. |
| 15 | Notification rules | **Blocked** | Triggers, throttling, and preferences are `X`. |
| 16 | Payment settlement behavior | **Partially answered** | The end-to-end PayPal flow and the provider-neutral ledger shape are `S1`. Proration, partial capture, and currency handling beyond "USD" are `X`. |
| 17 | Webhook idempotency | **Partially answered** | Replay protection and idempotent settlement are mandated by `S1`. The exact provider event identifiers to key on are `S4` (PayPal docs) and must be verified. |
| 18 | RLS / tenant isolation assumptions | **Answered at policy level** | The invariants are `S1` and are specified in [rls](../02-database/rls.md) and [tenant-isolation](../02-database/tenant-isolation.md). Whether legacy *violated* any of them is unknowable. |
| 19 | Security edge cases | **Partially answered** | The prohibition list is `S1` and drives [security-model](../07-security/security-model.md). Legacy-specific incidents are `X`. |
| 20 | Error / retry behavior | **Partially answered** | Job states, `attempt_count`, backoff, stale-job recovery are mandated by `S1`. Concrete backoff parameters and max attempts are `D`. |

**Summary: 3 answered, 8 partially answered, 9 fully blocked.**

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
- [ ] Audit is re-run and this document is superseded once the legacy repository is supplied.

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
