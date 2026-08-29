# Business Rules

## Purpose

The normative register of business rules for Myelektra Signal v2. This is the document an
implementer reads to know what the system must do and *why it is allowed to believe it*. Every rule
carries a provenance tag; a rule without a tag does not exist.

## Scope

In scope: rules that constrain behaviour across signal production, billing, access, jobs, and
administration. Out of scope: implementation detail (see `01-architecture`, `02-database`), and
anything the forensic audit was supposed to supply but could not — those live in the gap register at
[forensic-audit](forensic-audit.md) and are tagged `X` here.

## Source of truth

| Tag | Meaning |
| --- | --- |
| `S1` | Strategic brief for the v2 rebuild (2026-08-29). In hand, authoritative. |
| `S2` | Legacy documentation — **not available** in this workspace. |
| `S3` | Legacy source code — **not available** in this workspace. |
| `S4` | Third-party provider documentation; must be verified before implementation. |
| `D` | Proposed design decision from this rebuild. Requires approval. Not yet a rule. |
| `X` | Blocked. Unknown. Must not be invented. |

Rules below marked `X` are **not** rules. They are placeholders that record a known unknown so that
nobody later mistakes the silence for a decision.

## Requirements

These govern the register itself. The rules that govern the product are the numbered sections that
follow.

| ID | Requirement |
| --- | --- |
| R-BRM-1 | Every rule carries exactly one provenance tag. An untagged rule is not a rule. |
| R-BRM-2 | A rule tagged `X` records an unknown. It must not be implemented, and must not be silently replaced with a plausible value during implementation. |
| R-BRM-3 | A rule tagged `D` is a proposal. It requires approval before the code it governs is written, and becomes `S1`-equivalent once approved. |
| R-BRM-4 | Rules are domain policy. They are implemented in the server-side domain core and enforced by database constraints — never in React ([system-architecture R-SA-3](../01-architecture/system-architecture.md#r-sa-3-dependency-rules-d)). |
| R-BRM-5 | Every rule is testable as written, or it is rewritten until it is. |
| R-BRM-6 | Changing a rule updates this file, its tests, and any document citing it, in the same commit. |
| R-BRM-7 | Where a rule is enforced in the database, the enforcement is named in the rule or in [schema](../02-database/schema.md). A rule with no enforcement point is a preference. |
| R-BRM-8 | Conflicts between rules are resolved by the precedence list in [forensic-audit](../00-product/forensic-audit.md#conflict-list) and the resolution is recorded here. |

---

## 1. Signal scoring `S1`

| ID | Rule | Tag |
| --- | --- | --- |
| BR-SC-01 | A published Signal's score is the weighted sum of exactly six components. | `S1` |
| BR-SC-02 | `account_fit` carries weight 25%. | `S1` |
| BR-SC-03 | `signal_strength` carries weight 25%. | `S1` |
| BR-SC-04 | `freshness` carries weight 15%. | `S1` |
| BR-SC-05 | `buyer_relevance` carries weight 15%. | `S1` |
| BR-SC-06 | `commercial_scale` carries weight 10%. | `S1` |
| BR-SC-07 | `evidence_quality` carries weight 10%. | `S1` |
| BR-SC-08 | Weights sum to 100 and are not configurable per tenant. | `S1` (weights) / `D` (non-configurability) |
| BR-SC-09 | Scoring is deterministic: identical inputs produce an identical score and band. No random, time-of-day, or model-temperature input may reach the arithmetic. | `D` — follows from the brief's "deterministic scoring" pipeline stage |
| BR-SC-10 | Each component is normalised to an integer 0–100 before weighting; total = round(Σ weightᵢ × componentᵢ / 100). | `D` — needs approval |
| BR-SC-11 | The score and all six component values are persisted with the Signal at publication time and are immutable thereafter. | `D` |
| BR-SC-12 | The frontend never computes, recomputes, adjusts, or re-derives a score. It renders the stored value. | `S1` |

### Score bands `S1`

| Band | Range |
| --- | --- |
| `HIGH` | 80–100 |
| `MEDIUM` | 60–79 |
| `WATCH` | 30–59 |
| `LOW` | 0–29 |

| ID | Rule | Tag |
| --- | --- | --- |
| BR-SC-13 | Bands are inclusive on both ends and partition 0–100 with no gap and no overlap. | `S1` |
| BR-SC-14 | Band is derived from score at write time and stored, never derived at read time. | `D` |
| BR-SC-15 | A score that falls outside 0–100 is a data-integrity failure and must be rejected at write, not clamped. | `D` |

### Component definitions `X`

| ID | Rule | Tag |
| --- | --- | --- |
| BR-SC-20 | What evidence drives `account_fit`, and how it maps to 0–100. | `X` |
| BR-SC-21 | What drives `signal_strength`, and its mapping. | `X` |
| BR-SC-22 | The freshness decay curve (half-life, floor). | `X` |
| BR-SC-23 | What makes a signal `buyer_relevant` to a given monitoring profile. | `X` |
| BR-SC-24 | How `commercial_scale` is estimated (revenue band, headcount, deal size). | `X` |
| BR-SC-25 | How `evidence_quality` grades a source (authority, primary vs secondary, recency). | `X` |
| BR-SC-26 | Tie-breaking and ordering of Signals with equal scores. | `X` |

---

## 2. Signal publication `S1`

| ID | Rule | Tag |
| --- | --- | --- |
| BR-SG-01 | **No evidence, no published Signal.** A candidate without verified evidence is never published, regardless of score. This is an absolute gate, not a scoring penalty. | `S1` |
| BR-SG-02 | A published Signal must carry: company/event, signal type, source name, source URL, evidence summary, freshness, confidence, commercial implication, recommended action, score, and all score components. | `S1` |
| BR-SG-03 | Publication date is included **when available**; its absence does not block publication but must be visible as absent rather than defaulted to today. | `S1` |
| BR-SG-04 | Limitations are included **if any exist**; the field must be capable of being empty without being hidden. | `S1` |
| BR-SG-05 | A Signal is published only by the pipeline. No customer-facing or admin-facing write path may create a published Signal directly. | `D` |
| BR-SG-06 | A Signal's score is final once published; correction requires a new Signal version, not a mutation. | `D` — reinforces BR-SC-11 and the brief's "customer cannot change final Signal score" |
| BR-SG-07 | The Signal *type* taxonomy (what categories exist). | `X` |
| BR-SG-08 | The state machine a candidate traverses between discovery and publication/discard. | `X` |
| BR-SG-09 | Whether a rejected candidate is retained for audit or discarded. | `X` |

---

## 3. Evidence `S1`

| ID | Rule | Tag |
| --- | --- | --- |
| BR-EV-01 | Evidence is stored as first-class rows linked to a Signal, not as free text embedded in the Signal. | `D` — required to satisfy the publication gate mechanically |
| BR-EV-02 | Each evidence row records a source name and a resolvable source URL. | `S1` |
| BR-EV-03 | Verification is a privileged act. Customers cannot mark evidence verified. | `S1` |
| BR-EV-04 | Every evidence row records who verified it and when. | `D` |
| BR-EV-05 | Unverified evidence may exist in the database; it may not be attached to a *published* Signal. | `D` |
| BR-EV-06 | Minimum number of independent sources required to publish. | `X` |
| BR-EV-07 | What qualifies a source as authoritative enough to verify. | `X` |
| BR-EV-08 | Behaviour when a source URL later 404s or the source is retracted. | `X` |
| BR-EV-09 | Retention period for evidence after a Signal is superseded. | `X` |

---

## 4. Deduplication and material update

| ID | Rule | Tag |
| --- | --- | --- |
| BR-DD-01 | The pipeline has an explicit deduplication stage between evidence verification and scoring; it is not implicit in the writer. | `S1` |
| BR-DD-02 | A duplicate must not create a second published Signal for the same underlying event within the same organization. | `D` |
| BR-DD-03 | Deduplication scope is the organization (tenant), not global. Two tenants may legitimately hold Signals about the same real-world company. | `D` |
| BR-DD-04 | The identity key that decides "same event". | `X` |
| BR-DD-05 | Similarity threshold and the algorithm that applies it. | `X` |
| BR-DD-06 | What counts as a *material update* to an existing Signal rather than a new one (new funding round on the same company, revised headcount, corrected source). | `X` |
| BR-DD-07 | Whether a material update re-scores in place, appends, or supersedes. | `X` |

---

## 5. Monitoring

| ID | Rule | Tag |
| --- | --- | --- |
| BR-MN-01 | The daily Signal run is dispatched by Supabase Cron at `0 3 * * *` (UTC). | `S1` |
| BR-MN-02 | The daily process must not depend on a browser being open, and must not be a single long function that cannot be resumed after failure. | `S1` |
| BR-MN-03 | Cron is a dispatcher only. It creates or resumes work; it does not perform work. | `S1` |
| BR-MN-04 | Monitoring is driven by `monitoring_profiles` and `monitored_accounts` scoped to an organization. | `S1` (table names) |
| BR-MN-05 | Per-account monitoring cadence. | `X` |
| BR-MN-06 | Maximum monitored accounts per plan. | `X` — see package limits |
| BR-MN-07 | Behaviour when a monitored account is removed mid-cycle. | `X` |

---

## 6. Packages, quotas, entitlements

| ID | Rule | Tag |
| --- | --- | --- |
| BR-PK-01 | The catalog is exactly three plans: **Signal Lite $19/month**, **Signal Pro $49/month**, **Signal Elite $99/month**. | `S1` |
| BR-PK-02 | All pricing is USD. | `S1` |
| BR-PK-03 | Billing period is monthly subscription. | `S1` |
| BR-PK-04 | Price and package are resolved server-side from a plan *key* sent by the browser. The browser never sends an amount or a currency. | `S1` |
| BR-PK-05 | The authoritative price lives in the database (packages table), not in frontend code and not in the Edge Function source. | `D` |
| BR-PK-06 | Per-plan quotas: monitored accounts, Signals delivered per day, seats, contacts, opportunities. | `X` — **must not be invented** |
| BR-PK-07 | Quota enforcement mode: hard stop, soft warning, or overage. | `X` |
| BR-PK-08 | Whether unused quota rolls over. | `X` |
| BR-PK-09 | What each plan entitles beyond price (feature gates vs volume gates). | `X` |
| BR-PK-10 | Effect of a mid-cycle upgrade or downgrade on quota and on already-delivered Signals. | `X` |

---

## 7. Access and subscription state `S1`

### Access states

```
PENDING_PAYMENT → PAYMENT_PROCESSING → PAID_ONBOARDING → ACTIVE
                                                         ↘ SUSPENDED
```

| ID | Rule | Tag |
| --- | --- | --- |
| BR-AC-01 | The access-state set is exactly: `PENDING_PAYMENT`, `PAYMENT_PROCESSING`, `PAID_ONBOARDING`, `ACTIVE`, `SUSPENDED`. | `S1` |
| BR-AC-02 | Access state is server-owned. Customers cannot set or change it. | `S1` |
| BR-AC-03 | Access state is stored on the organization, not on the user. | `D` |
| BR-AC-04 | Resolution order for every request: authenticate → resolve organization membership → resolve payment/access state → resolve onboarding state → allow or deny. | `S1` |
| BR-AC-05 | Route hiding in the frontend is a UX affordance and is never an authorization control. | `S1` |
| BR-AC-06 | `PAID_ONBOARDING` grants data access only after onboarding completes; what "complete" requires. | `X` |
| BR-AC-07 | Trigger for entering `SUSPENDED` (failed renewal, dispute, manual admin action, non-payment grace period length). | `X` |
| BR-AC-08 | Whether `SUSPENDED` is reversible and by whom. | `X` |
| BR-AC-09 | Data visibility while `SUSPENDED` (read-only historical, or fully blocked). | `X` |

### Subscription

| ID | Rule | Tag |
| --- | --- | --- |
| BR-SB-01 | A subscription row is created when a PayPal subscription is initiated and is reconciled from provider events thereafter. | `D` |
| BR-SB-02 | Renewal handling, cancellation handling, and payment-failure handling are all explicit pipeline concerns with named behaviour. | `S1` (requirement to handle) / `X` (the actual behaviour) |
| BR-SB-03 | Refunds and disputes are recorded as records; they are never silently dropped. | `S1` |
| BR-SB-04 | Mapping from PayPal subscription state to internal subscription state. | `X` |
| BR-SB-05 | Grace period and dunning schedule on failed renewal. | `X` |
| BR-SB-06 | Proration on plan change. | `X` |

---

## 8. Payment `S1`

| ID | Rule | Tag |
| --- | --- | --- |
| BR-PM-01 | **PayPal Business is the only customer checkout provider.** No Mayar, no Midtrans, no Stripe in any path. All are marked LEGACY — EXCLUDED in [legacy-exclusion-list](legacy-exclusion-list.md). | `S1` |
| BR-PM-02 | Currency is USD only — for prices, payments, subscriptions, and every PayPal transaction. Enforced by `check (currency = 'USD')`, not by a default. | `S1` |
| BR-PM-03 | The browser sends a plan key and nothing else about money. It must never send amount, currency override, access state, payment status, role, another tenant's `organization_id`, or any secret/token. | `S1` |
| BR-PM-04 | Server-side order/subscription creation is the only path to a PayPal transaction. | `S1` |
| BR-PM-05 | Buyer approval happens through the PayPal JS SDK in the browser; the browser's approval is never sufficient. Server-side webhook verification **and** read-back of the transaction are required before entitlement changes. | `S1` |
| BR-PM-06 | Settlement is idempotent. Re-delivering the same provider event must not create a second ledger entry or a second entitlement change. | `S1` |
| BR-PM-07 | Webhooks are verified cryptographically and protected against replay. | `S1` |
| BR-PM-08 | Payment records are provider-scoped. There is **no** single global `transaction_id`; uniqueness is `(provider, provider_transaction_id)`. | `S1` |
| BR-PM-09 | The payment ledger is provider-neutral and carries: `provider`, `provider_order_id`, `provider_transaction_id`, `provider_subscription_id`, `internal_order_id`, `customer_id`, `amount`, `currency`, `status`, `paid_at`, `metadata`. | `S1` |
| BR-PM-10 | Entitlement is updated only after settlement succeeds, and it moves access state `PAYMENT_PROCESSING → PAID_ONBOARDING → ACTIVE`. | `S1` |
| BR-PM-11 | Payment reconciliation runs on cron at `*/5 * * * *`. | `S1` |
| BR-PM-12 | Every privileged payment mutation is written to `audit_logs`. | `S1` |
| BR-PM-13 | There is no public test or debug payment endpoint in any environment. | `S1` |
| BR-PM-14 | Sandbox and live PayPal configurations are distinct, and selection is environment-driven, never request-driven. | `D` |
| BR-PM-15 | There is no IDR, no FX rate, no exchange rate, and no currency conversion of any kind. Currency is never derived from country, locale, IP, or preference. | `S1` |
| BR-PM-16 | All provider costs — OpenAI tokens, search queries, email and any other provider — are recorded in USD. | `S1` |
| BR-PM-17 | COGS and margin are USD. Margin is USD revenue minus USD COGS; both operands are USD by construction. | `S1` |
| BR-PM-18 | Every monetary column is named `*_usd` and uses an exact decimal type (`numeric(p,s)`). Floating-point types (`float`, `real`, `double precision`) are prohibited. Amounts are non-negative. | `S1` |

---

## 9. Roles and administration `S1`

| ID | Rule | Tag |
| --- | --- | --- |
| BR-RB-01 | Roles are explicit and stored, minimum set `CUSTOMER`, `ADMIN`, `SUPER_ADMIN`. | `S1` |
| BR-RB-02 | Customers cannot change their own or anyone else's role. | `S1` |
| BR-RB-03 | Admin access is always authorized server-side. | `S1` |
| BR-RB-04 | All privileged mutations are recorded in `audit_logs`. | `S1` |
| BR-RB-05 | `audit_logs` is append-only; no update or delete path exists for any role. | `D` |
| BR-RB-06 | The per-action permission matrix separating `ADMIN` from `SUPER_ADMIN`. | `X` |
| BR-RB-07 | Whether an `ADMIN` is scoped to one organization or is platform-wide. | `X` |
| BR-RB-08 | How the first `SUPER_ADMIN` is provisioned. | `X` |

---

## 10. Jobs and scheduling `S1`

| ID | Rule | Tag |
| --- | --- | --- |
| BR-JB-01 | Job states are exactly `QUEUED`, `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED`. | `S1` |
| BR-JB-02 | Every job carries `id`, `organization_id`, `run_id`, `job_type`, `status`, `attempt_count`, `available_at`, `locked_at`, `locked_by`, `last_error`, `created_at`, `completed_at`. | `S1` |
| BR-JB-03 | Jobs are Postgres-backed. No in-memory or browser-owned queue exists. | `S1` |
| BR-JB-04 | Each job has an idempotency key. | `S1` |
| BR-JB-05 | Jobs are claimed under a lease/lock so that concurrent workers cannot both run the same job. | `S1` |
| BR-JB-06 | Batches are bounded; a run never attempts an unbounded number of organizations in one invocation. | `S1` |
| BR-JB-07 | Failures retry with backoff, and one job's failure does not fail the run. | `S1` |
| BR-JB-08 | Stale leases are recovered: a job whose lock has expired returns to the queue. | `S1` |
| BR-JB-09 | A duplicate run for the same organization and day is prevented. | `S1` |
| BR-JB-10 | `PARTIAL` means the run completed with at least one unit failed and at least one succeeded; it is a distinct terminal state, not a soft `FAILED`. | `D` |
| BR-JB-11 | Max attempt count, backoff base, backoff cap, and lease duration. | `D` — proposed values need approval; `X` if legacy had specific numbers |
| BR-JB-12 | Whether a `FAILED` job is retried on the next daily run or requires manual admin action. | `X` |

---

## 11. Delivery and notification

| ID | Rule | Tag |
| --- | --- | --- |
| BR-DL-01 | Delivery is the final pipeline stage and operates on a daily read model built from persisted Signals. | `S1` |
| BR-DL-02 | Every delivery attempt is recorded in `delivery_attempts`. | `D` — the table is named in the brief |
| BR-DL-03 | Delivery channels, schedule, format, and per-channel failure policy. | `X` |
| BR-DL-04 | Notification triggers, throttling, and user preference model. | `X` |
| BR-DL-05 | Whether delivery failure blocks the Signal from being visible in-app. | `X` |

---

## 12. Tenant isolation `S1`

| ID | Rule | Tag |
| --- | --- | --- |
| BR-TI-01 | Tenant isolation is a **database invariant**, enforced by RLS, not an application convention. | `S1` |
| BR-TI-02 | Every tenant-owned row carries `organization_id`. | `S1` |
| BR-TI-03 | A customer cannot read another tenant's rows. | `S1` |
| BR-TI-04 | A customer cannot write to another tenant's rows. | `S1` |
| BR-TI-05 | Tenant scope is never taken from the client. It is derived from the authenticated identity and membership. | `S1` |
| BR-TI-06 | Payment provider references are provider-scoped (see BR-PM-08). | `S1` |
| BR-TI-07 | RLS is enabled on every tenant-owned table with no permissive fallback policy. Absence of a policy means denial. | `D` |

---

## Security considerations

- The provenance system is itself a security control: it prevents an implementer from treating an
  inference as an approved rule. An `X` that is silently filled in during Phase 3 is an
  unreviewed business decision shipped as code.
- BR-PM-03, BR-AC-02, BR-RB-02 and BR-SC-12 together form the "client sends no authority" contract.
  Any endpoint that accepts amount, status, role, access state, or foreign `organization_id` from a
  request body violates this document.
- BR-PM-13 is absolute and environment-independent: a sandbox-only debug checkout endpoint is still
  a public test payment endpoint.

## Acceptance criteria

- [x] Every rule carries a provenance tag.
- [x] No rule is stated without either `S1` grounding or an explicit `D` proposal flag.
- [x] All 20 forensic audit targets are represented, including the ones that are `X`.
- [ ] Every `X` is resolved or explicitly re-scoped out before Phase 3 begins.
- [ ] Every `D` is approved by the product owner before the code it governs is written.

## Related skills

- [`clean-architecture`](../SKILLS.md#clean-architecture) — rules are domain policy; they must not live in React.
- [`clean-code`](../SKILLS.md#clean-code) — one rule, one ID, one testable statement.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — don't live with broken windows; `X` items are tracked, not ignored.
- [`ddia-systems`](../SKILLS.md#ddia-systems) — idempotency and exactly-once reasoning in §10.

## Open decisions

All `X` items above are open decisions. They are consolidated with owners and blocking status in
[open-decisions](open-decisions.md). The three that block the most work:

- **OD-BR-1** Package quotas and entitlements (BR-PK-06 … BR-PK-10). Blocks schema columns, the
  checkout flow's plan resolution, and the entire customer dashboard's usage surfaces.
- **OD-BR-2** Signal type taxonomy and component definitions (BR-SG-07, BR-SC-20 … BR-SC-26).
  Blocks the scoring module, which is the heart of Phase 3.
- **OD-BR-3** Deduplication identity and material-update semantics (BR-DD-04 … BR-DD-07). Blocks
  the deduplication stage and the Signal uniqueness constraint.
