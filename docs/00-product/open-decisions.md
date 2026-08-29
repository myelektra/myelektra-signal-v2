# Open Decisions and Blockers

## Purpose

The single register of everything unresolved, with its blocking status. No item here may be resolved
silently in code: resolving one means updating this file in the same commit.

## Scope

In scope: architecture, security, contract, and product decisions that are undecided, plus the
blockers that stop phases from starting. Out of scope: ordinary implementation choices that need no
approval.

## Source of truth

- `S1` Strategic brief — the instruction to use GitHub Issues/PRs for unresolved architecture,
  security, and contract decisions, and the operating rule to always state what was not implemented
  and what the known limitations are.
- [forensic-audit](../00-product/forensic-audit.md) — why most `X` items exist.
- [business-rules](../00-product/business-rules.md) — the `X` and `D` items consolidated here.

## Requirements

| ID | Requirement |
| --- | --- |
| R-OD-1 | This is the single register. Every `X` and `D` tag anywhere in `docs/**` has a row here. |
| R-OD-2 | No item is resolved silently in code. Resolving one updates this file in the same commit. |
| R-OD-3 | A `D` item records a proposal, so approval is a yes/no rather than a research task. |
| R-OD-4 | An `X` item records a question, not a blank to fill. It carries no proposed value. |
| R-OD-5 | Every blocker (`B-n`) names what it blocks and what would unblock it. |
| R-OD-6 | Every blocker has a named owner before Phase 1 completes. |
| R-OD-7 | An item explicitly accepted as unresolved is recorded with who accepted it, so acceptance is a decision rather than an omission. |
| R-OD-8 | Items representing a security exposure are flagged as such, whether or not the brief mentions them. |

## Blockers

| ID | Blocker | Blocks | Needs |
| --- | --- | --- | --- |
| **B-1** | **The legacy repository `/home/user/myelektra-signal-saas` is absent**, and `myelektra/myelektra-signal-saas` does not resolve on GitHub. Verified this session: `ls /home/user` shows only `myelektra-signal-v2`; `find / -iname "*myelektra*"` returns one hit; `gh repo view` returns `Could not resolve to a Repository`. | The forensic audit (Phase 0 deliverable 1), and every `X` item below. Also Phase 5's Clean Clay design system. | The repository, a read-only export, or written confirmation it is unrecoverable. |
| **B-2** | Package quotas and entitlements are undefined. | Schema `packages.limits`, checkout plan resolution, the customer dashboard's usage surfaces, quota enforcement tests. | A product decision. Must not be invented. |
| **B-3** | Signal type taxonomy and score-component definitions are undefined. | The scoring module — the core of Phase 3. | A product decision. |
| **B-4** | Deduplication identity and material-update semantics are undefined. | The deduplication stage and the Signal uniqueness constraint. | A product decision. |
| **B-5** | PayPal API surface is unverified against provider documentation. | Phase 7 in its entirety. | Provider documentation review; OD-PP-1. |

## Decisions requiring approval (`D`)

These have a proposal. They need a yes, not research.

| ID | Decision | Proposal | Document |
| --- | --- | --- | --- |
| OD-SA-1 | Repository layout | Workspaces: `apps/web`, `packages/domain`, `supabase/functions` | [system-architecture](../01-architecture/system-architecture.md) |
| OD-SA-3 | Daily read model | Table populated by the pipeline, not a materialized view | [system-architecture](../01-architecture/system-architecture.md) |
| OD-SC-1 | Score normalization | Each component 0–100 integer; total = round(Σ w·c/100) | [scoring](../04-signals/scoring.md) |
| OD-DB-1 | Score components storage | `jsonb` with a key-presence `check` | [schema](../02-database/schema.md) |
| OD-DB-5 | Usage period basis | Subscription period, not calendar month | [schema](../02-database/schema.md) |
| OD-RL-2 | Admin visibility of payment metadata | Full for `SUPER_ADMIN`, redacted view for `ADMIN` | [rls](../02-database/rls.md) |
| OD-RL-3 | Public plan catalog source | `anon`-granted view filtered to `is_active` | [rls](../02-database/rls.md) |
| OD-PP-3 | Webhook timestamp window | 5 minutes | [paypal](../05-billing/paypal.md) |
| OD-JB-1 | Job parameters | Lease 10m, max 5 attempts, backoff 1m→60m, batch 25 | [cron](../06-jobs/cron.md) |
| OD-JB-2 | Worker drain schedule | Add a per-minute `signal-worker` cron | [cron](../06-jobs/cron.md) |
| OD-JB-5 | Alerting channel | Admin Action Required queue first; external alerting later | [cron](../06-jobs/cron.md) |
| OD-SM-1 | Secret scanner | Chosen in Phase 1; must scan build artifacts | [security-model](../07-security/security-model.md) |
| OD-SM-4 | Rate limiting | Add to checkout and auth endpoints; not in the brief | [security-model](../07-security/security-model.md) |
| OD-TS-1 | SQL test harness | Decide pgTAP vs `bun test`-driven SQL | [test-strategy](../10-testing/test-strategy.md) |
| OD-TS-2 | CI database | Local Supabase via Docker, or ephemeral hosted project | [test-strategy](../10-testing/test-strategy.md) |
| OD-TS-3 | E2E framework | Playwright | [test-strategy](../10-testing/test-strategy.md) |
| OD-TS-4 | Coverage threshold | Measure a baseline first, then set one | [test-strategy](../10-testing/test-strategy.md) |

## Decisions requiring information (`X`)

These cannot be proposed responsibly without a source. Each is a question, not a gap to fill.

### Product

| ID | Question | From |
| --- | --- | --- |
| OD-BR-1 | What are the per-plan quotas (monitored accounts, Signals/day, seats, contacts, opportunities)? | BR-PK-06 |
| OD-BR-2 | What is the signal type taxonomy? | BR-SG-07 |
| OD-BR-3 | How is each of the six score components computed from evidence? | BR-SC-20…26 |
| OD-BR-4 | What makes an update to an existing Signal "material"? | BR-DD-06 |
| OD-BR-5 | What is the deduplication identity key and threshold? | BR-DD-04, BR-DD-05 |
| OD-BR-6 | What are the onboarding completion criteria for `PAID_ONBOARDING → ACTIVE`? | BR-AC-06 |
| OD-BR-7 | What triggers `SUSPENDED`, and is it reversible? | BR-AC-07, BR-AC-08 |
| OD-BR-8 | What is visible to a customer while `SUSPENDED`? | BR-AC-09 |
| OD-BR-9 | Minimum independent sources required to publish a Signal? | BR-EV-06 |
| OD-BR-10 | Behaviour when a source URL later 404s? | BR-EV-08 |
| OD-BR-11 | Delivery channels, schedule, format, and failure policy? | BR-DL-03 |
| OD-BR-12 | Notification triggers, throttling, and preferences? | BR-DL-04 |

### Authorization

| ID | Question | From |
| --- | --- | --- |
| OD-AU-1 | Which Supabase Auth sign-in methods are enabled? | R-AU-8 |
| OD-RB-1 | Is `ADMIN` platform-scoped or organization-scoped? | BR-RB-07 — **also blocks the RLS policy matrix** |
| OD-RB-2 | The per-action permission matrix for `ADMIN` vs `SUPER_ADMIN` | BR-RB-06 |
| OD-RB-3 | How is the first `SUPER_ADMIN` provisioned? | R-AU security |

### Billing

| ID | Question | From |
| --- | --- | --- |
| OD-PP-1 | Verify the PayPal API surface: Subscriptions vs Orders v2, verification parameters, event type names | R-PP-6 — **blocking Phase 7** |
| OD-PP-2 | PayPal plan ids per package, and how they are created | R-PP-1 |
| OD-PP-4 | Renewal-failure behaviour: grace period, dunning, access state during dunning | BR-SB-05 |
| OD-PP-5 | Cancellation semantics: end-of-period vs immediate; refund policy | R-PP-6 |
| OD-PP-6 | Do refunds and disputes move access state to `SUSPENDED`? | R-PP-6 |
| OD-SB-1 | The provider-state to internal-state mapping | BR-SB-04 |

### Data

| ID | Question | From |
| --- | --- | --- |
| OD-DB-2 | `confidence` and `freshness` enumerations | R-DB-3 |
| OD-DB-3 | Retention for `audit_logs` and `payment_events.payload` (shared with OD-SM-3) | R-DB-3 |
| OD-DB-4 | The purpose and columns of `existing_buyers` | R-DB-3 |
| OD-JB-3 | Is a maxed-out `FAILED` job retried next day or does it need admin action? | BR-JB-12 |
| OD-JB-4 | Is `pg_net` enabled on the target Supabase project? | R-CR-2 |

### Design

| ID | Question | From |
| --- | --- | --- |
| OD-LC-2 | Where is the Clean Clay design system defined? It was in the legacy `DESIGN.md` | [legacy-carryover](../01-architecture/legacy-carryover-decisions.md) |
| OD-UI-1 | Homepage copy and evidence-backed positioning claims — what evidence exists to cite? | [homepage](../09-ui/homepage.md) |

## Recommended resolution order

1. **B-1** — unblock the source. Everything else tagged `X` may already have an answer there.
2. **OD-RB-1** — a single decision that unblocks the RLS matrix and the admin control plane.
3. **B-2 / B-3 / B-4** — the three product decisions that unblock Phase 3.
4. **OD-PP-1** — verifiable independently by reading provider documentation; unblocks Phase 7.
5. The `D` items — batchable into one approval pass; none requires research.

## Appendix — document-local open decisions

Every open decision raised inside a document's own `Open decisions` section, indexed here so that R-OD-1 holds: this file is the single register. Items promoted to a blocker or to a cross-cutting decision appear in the tables above and are not repeated here. Type is taken from the raising document where it stated one; where it did not, `D` means a design choice proposed here that needs a yes/no, and `X` means the item depends on an undefined business rule or on a fact not yet verified.

| ID | Question or proposal | Raised in | Type |
| --- | --- | --- | --- |
| OD-FA-1 | Supply the legacy repository, a read-only export of it, or written confirmation that it is unrecoverable. Same subject as blocker **B-1**; listed here so the id resolves. | [forensic-audit.md](forensic-audit.md) | `X` |
| OD-AD-1 | Whether admin actions are one function per action or one with an action parameter. Recommend per-action (OD-BE-4) | [admin-control-plane.md](../08-admin/admin-control-plane.md) | `D` |
| OD-AD-2 | Whether Action Required items are grouped by customer, by failure type, or by severity | [admin-dashboard.md](../09-ui/admin-dashboard.md) | `D` |
| OD-AD-3 | Whether admin dashboards need real-time updates or polling suffices | [admin-dashboard.md](../09-ui/admin-dashboard.md) | `D` |
| OD-AU-2 | Whether SUSPENDED permits read-only historical access. (BR-AC-09) | [authentication-authorization.md](../03-auth/authentication-authorization.md) | `X` |
| OD-BE-1 | Whether signal-worker is a distinct function or an invocation mode of signal-dispatch. Recommend distinct (R-BE-1); needs approval with OD-JB-2 | [backend.md](../01-architecture/backend.md) | `D` |
| OD-BE-2 | Edge Function wall-clock and memory limits on the target project — determines the batch size in cron R-CR-6 | [backend.md](../01-architecture/backend.md) | `X` |
| OD-BE-3 | Structured logging format and destination | [backend.md](../01-architecture/backend.md) | `D` |
| OD-BE-4 | Whether admin actions are one function with an action parameter or one function per action. Recommend per-action for authorization clarity | [backend.md](../01-architecture/backend.md) | `D` |
| OD-CD-1 | Opportunities and Contacts semantics — both are named surfaces whose domain rules are undefined | [customer-dashboard.md](../09-ui/customer-dashboard.md) | `X` |
| OD-CD-2 | Whether Notifications is a surface, a popover, or both | [customer-dashboard.md](../09-ui/customer-dashboard.md) | `D` |
| OD-CD-3 | Signal list ordering and filtering, which depends on the signal taxonomy (OD-BR-2) | [customer-dashboard.md](../09-ui/customer-dashboard.md) | `X` |
| OD-DD-1 | Supersede versus append on material update (BR-DD-07) | [deduplication.md](../04-signals/deduplication.md) | `X` |
| OD-DD-2 | Whether customers can see that a Signal superseded an earlier one | [deduplication.md](../04-signals/deduplication.md) | `D` |
| OD-DD-3 | Whether deduplication decisions are retained for audit and for how long | [deduplication.md](../04-signals/deduplication.md) | `D` |
| OD-DP-1 | Branch-per-PR preview databases: Supabase branching, or a shared staging project | [deployment.md](../01-architecture/deployment.md) | `D` |
| OD-DP-2 | How PayPal webhooks reach staging. Local tunneling exposes an endpoint publicly, which conflicts with the spirit of R-DP-2; a staged deploy target may be required | [deployment.md](../01-architecture/deployment.md) | `D` |
| OD-DP-3 | Domain, DNS, and email sending domain configuration | [deployment.md](../01-architecture/deployment.md) | `D` |
| OD-DP-4 | Monitoring and alerting provider for R-DP-7 (shared with OD-JB-5) | [deployment.md](../01-architecture/deployment.md) | `D` |
| OD-EN-1 | Feature gates vs volume gates per plan | [entitlements.md](../05-billing/entitlements.md) | `X` |
| OD-EN-2 | Entitlement behaviour on suspension and refund (shared with OD-PP-6) | [entitlements.md](../05-billing/entitlements.md) | `D` |
| OD-EV-1 | Source authority grading (BR-EV-07) — feeds evidence_quality | [evidence.md](../04-signals/evidence.md) | `X` |
| OD-EV-2 | Behaviour on source retraction or 404 (BR-EV-08): withdraw the Signal, annotate it, or leave it | [evidence.md](../04-signals/evidence.md) | `X` |
| OD-EV-3 | Evidence retention (BR-EV-09) | [evidence.md](../04-signals/evidence.md) | `X` |
| OD-EV-4 | Whether the pipeline re-checks source URLs on a schedule. Cost and integrity trade-off | [evidence.md](../04-signals/evidence.md) | `D` |
| OD-FA-2 | If the legacy repository is genuinely unrecoverable, decide whether the X items are re-specified from scratch as new product decisions (which is legitimate) or left unimplemented (which shrinks v2's scope). This is a product-owner decision, not an engineering one | [forensic-audit.md](forensic-audit.md) | `X` |
| OD-FE-1 | Is SSR/SSG needed for the homepage's SEO? The brief specifies an SPA | [frontend.md](../01-architecture/frontend.md) | `D` |
| OD-FE-2 | Data-fetching library choice | [frontend.md](../01-architecture/frontend.md) | `D` |
| OD-FE-3 | Internationalization. The brief is USD-only and English-implied; not stated | [frontend.md](../01-architecture/frontend.md) | `X` |
| OD-FE-4 | Whether the Signal detail's six sections are tabs, stacked, or progressive disclosure — a design decision needing the design system | [frontend.md](../01-architecture/frontend.md) | `X` |
| OD-HP-1 | Is an FAQ or a "how it works" section required? "See how it works" implies one exists | [homepage.md](../09-ui/homepage.md) | `D` |
| OD-HP-2 | SEO requirements, which interact with the SPA decision (OD-FE-1) | [homepage.md](../09-ui/homepage.md) | `D` |
| OD-ID-1 | Whether unit_id in the job key is the monitored account, the candidate batch, or something else. Depends on the pipeline's unit definition, which depends on OD-BR-2 | [idempotency.md](../06-jobs/idempotency.md) | `X` |
| OD-ID-2 | A separate idempotency key scheme for delivery attempts and notifications | [idempotency.md](../06-jobs/idempotency.md) | `D` |
| OD-ID-3 | Whether client-initiated mutations (for example, creating an opportunity) carry a client-generated idempotency key. Recommended, but not in the brief | [idempotency.md](../06-jobs/idempotency.md) | `D` |
| OD-JL-1 | Whether leases are renewable mid-execution | [job-lifecycle.md](../06-jobs/job-lifecycle.md) | `D` |
| OD-JL-2 | Retention for completed job rows | [job-lifecycle.md](../06-jobs/job-lifecycle.md) | `D` |
| OD-LC-1 | This inventory cannot be confirmed complete without the legacy repository. When it is supplied, re-run the audit and add any additional artefacts found | [legacy-carryover-decisions.md](../01-architecture/legacy-carryover-decisions.md) | `X` |
| OD-LC-3 | Whether the legacy repository is archived or deleted once v2 is live | [legacy-carryover-decisions.md](../01-architecture/legacy-carryover-decisions.md) | `D` |
| OD-MG-1 | Migration tooling: Supabase CLI migrations, or another runner | [migrations.md](../02-database/migrations.md) | `D` |
| OD-MG-2 | Whether preview environments get a branched database or a shared one (shared with OD-DP-1) | [migrations.md](../02-database/migrations.md) | `D` |
| OD-MG-3 | Whether packages seed data lives in a migration or is inserted by an admin at setup. Recommend a migration, so prices cannot drift between environments | [migrations.md](../02-database/migrations.md) | `D` |
| OD-PC-1 | Who signs off on an explicitly accepted unavailable item. Recommend the product owner in writing, recorded here | [production-checklist.md](../10-testing/production-checklist.md) | `D` |
| OD-PC-2 | Whether a staging dress rehearsal is mandatory before live payment cutover. Recommend yes; it is the only way R-PC-7 becomes verified rather than assumed | [production-checklist.md](../10-testing/production-checklist.md) | `D` |
| OD-RC-1 | The staleness thresholds in R-RC-2 | [reconciliation.md](../05-billing/reconciliation.md) | `D` |
| OD-RC-2 | Whether reconciliation should also detect provider-side refunds we never received a webhook for. Increases API cost; catches a real gap | [reconciliation.md](../05-billing/reconciliation.md) | `D` |
| OD-RC-3 | Whether an escalated discrepancy blocks further processing for that organization or only for that row | [reconciliation.md](../05-billing/reconciliation.md) | `D` |
| OD-RL-1 | Is ADMIN platform-scoped or organization-scoped? Determines whether the "read all" column in R-RL-3 is correct. Blocks the admin policy text | [rls.md](../02-database/rls.md) | `X` |
| OD-SA-2 | Which search provider(s) back candidate discovery, and what the per-run token/cost ceiling is. The brief names "search provider" generically | [system-architecture.md](../01-architecture/system-architecture.md) | `X` |
| OD-SA-4 | Whether OpenAI calls are batched per organization or per candidate; drives cost predictability | [system-architecture.md](../01-architecture/system-architecture.md) | `D` |
| OD-SC-2 | Tie-breaking rule (BR-SC-26) | [scoring.md](../04-signals/scoring.md) | `X` |
| OD-SC-3 | Whether a weight change requires re-scoring historical Signals or applies only going forward. Recommend forward-only, but it is a product decision | [scoring.md](../04-signals/scoring.md) | `D` |
| OD-SE-1 | Whether a commit-time secret scan runs in addition to the build-artifact scan. Recommended; both catch different mistakes | [secrets.md](../07-security/secrets.md) | `D` |
| OD-SE-2 | Rotation cadence as policy rather than incident-driven | [secrets.md](../07-security/secrets.md) | `D` |
| OD-SE-3 | Who holds Vault write access, and whether it requires SUPER_ADMIN | [secrets.md](../07-security/secrets.md) | `X` |
| OD-SG-1 | The lifecycle state machine (BR-SG-08) and rejected-candidate retention (BR-SG-09) | [signal-model.md](../04-signals/signal-model.md) | `X` |
| OD-SG-2 | Whether superseded Signals remain visible to the customer and for how long | [signal-model.md](../04-signals/signal-model.md) | `D` |
| OD-SK-1 | Will the legacy SKILLS.md be supplied? Until then all entries stay reference-only and skill application is judgement-based, not citation-based | [SKILLS.md](../SKILLS.md) | `X` |
| OD-SM-2 | Whether prompt-injection resistance for provider-sourced content needs a dedicated sanitization stage beyond structural validation | [security-model.md](../07-security/security-model.md) | `X` |
| OD-TI-1 | Minimum cohort size for admin aggregates | [tenant-isolation.md](../02-database/tenant-isolation.md) | `D` |
| OD-TI-2 | Whether a user may belong to multiple organizations. The schema permits it; the product may not intend it. Affects the resolution flow in R-AU-4 | [tenant-isolation.md](../02-database/tenant-isolation.md) | `X` |
| OD-UI-2 | Whether a free trial exists. Not mentioned in the brief; assumed absent | [product-requirements.md](product-requirements.md) | `X` |
| OD-VA-1 | The disallowed-domain list and the monitoring-scope predicate for cheap filtering | [validation.md](../04-signals/validation.md) | `D` |
| OD-VA-2 | The AI validation prompt and output schema. Requires the signal taxonomy (OD-BR-2) | [validation.md](../04-signals/validation.md) | `X` |
| OD-VA-3 | Per-candidate and per-job token budgets | [validation.md](../04-signals/validation.md) | `D` |
| OD-VA-4 | Rejection taxonomy and retention (OD-SG-1) | [validation.md](../04-signals/validation.md) | `X` |
| OD-VA-5 | Alert threshold for a falling validation success rate | [validation.md](../04-signals/validation.md) | `D` |

## Security considerations

- An `X` resolved silently in code is an unreviewed business decision shipped as production
  behaviour. This register exists to make that visible.
- **OD-SM-4 (rate limiting) is a real exposure, not a nice-to-have**, and it is absent from the
  brief. It is listed here rather than assumed.
- **OD-RB-3 (first `SUPER_ADMIN`)** must not be solved with an endpoint. Bootstrapping via migration
  or manual SQL only.

## Acceptance criteria

- [ ] Every `X` and `D` tag anywhere in `docs/**` has a corresponding row in this file.
- [ ] No code implements a rule tagged `X` in [business-rules](../00-product/business-rules.md).
- [ ] Resolving any item updates this file in the same commit.
- [ ] B-1 … B-5 each have a named owner before Phase 1 completes.

## Related skills

- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — track the unknowns instead of living with them.
- [`release-it`](../SKILLS.md#release-it) — a blocker list is a risk register.

## Open decisions

This document *is* the open-decisions register. See above.
