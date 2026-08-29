# Glossary

## Purpose

One definition per term, so that documents, code, and conversation use the same word for the same
thing. Where a term's precise semantics are undecided, the entry says so rather than inventing them.

## Scope

In scope: domain, billing, authorization, and pipeline vocabulary. Out of scope: general engineering
terms.

## Source of truth

`S1` Strategic brief for terms it names; `D` for terms introduced by this design; `X` where the
legacy definition is required and unavailable.

## Requirements

| ID | Requirement |
| --- | --- |
| R-GL-1 | One term, one definition. A term with two meanings is split into two terms. |
| R-GL-2 | Every domain term used in `docs/**` appears here. A term used but not defined is a defect. |
| R-GL-3 | A term whose semantics are undecided is marked `X` and linked to its open decision. It is never given a plausible definition to fill the gap. |
| R-GL-4 | Code identifiers match these terms. Renaming an identifier updates this file in the same commit. |
| R-GL-5 | Terms that correspond to an enforcement point — `verified evidence`, `published Signal`, `privileged mutation`, `tenant isolation` — are normative, and their definitions are the ones the tests assert. |
| R-GL-6 | A resolved `X` term moves to `S1` or `D` with its source named, and the corresponding row in [open-decisions](open-decisions.md) is closed in the same commit. |

## Terms

### Product

| Term | Definition | Tag |
| --- | --- | --- |
| **Signal** | A single evidence-backed commercial event relevant to a customer's monitoring scope, with a score, a commercial implication, and a recommended action. | `S1` |
| **Published Signal** | A Signal with `published_at` set. Requires at least one verified evidence row (BR-SG-01). | `S1` |
| **Candidate** | A discovered item that has not yet passed validation, evidence, and deduplication. Never visible to customers. | `D` |
| **Evidence** | A sourced fact supporting a Signal: source name, source URL, summary, and verification status. | `S1` |
| **Verified evidence** | Evidence marked verified by a privileged actor. Only verified evidence can support a published Signal. | `S1` |
| **Score** | Deterministic 0–100 weighted sum of six components. Computed server-side; never recomputed by a client. | `S1` |
| **Score band** | `HIGH` 80–100, `MEDIUM` 60–79, `WATCH` 30–59, `LOW` 0–29. | `S1` |
| **Score component** | One of `account_fit`, `signal_strength`, `freshness`, `buyer_relevance`, `commercial_scale`, `evidence_quality`. | `S1` |
| **Signal type** | The category of a Signal. The taxonomy is **undefined** (OD-BR-2). | `X` |
| **Freshness** | How recent the underlying event is. The enumeration and decay curve are **undefined** (OD-DB-2). | `X` |
| **Confidence** | How strongly the evidence supports the claim. Enumeration **undefined** (OD-DB-2). | `X` |
| **Opportunity** | A customer-created or pipeline-created commercial follow-up derived from Signals. Semantics **undefined** (legacy concept). | `X` |
| **Material update** | New information that changes an existing Signal rather than creating a new one. Definition **undefined** (OD-BR-4). | `X` |
| **Existing buyer** | An entity in `existing_buyers`. Purpose not recoverable without the legacy repository (OD-DB-4). | `X` |
| **Monitoring profile** | The customer-defined scope of what to watch. Columns **undefined**. | `X` |
| **Monitored account** | A specific company or entity being watched, within a monitoring profile. | `S1` (name) |
| **Daily read model** | The per-day, per-organization projection of Signals that delivery and the dashboard consume. | `S1` |
| **Clean Clay** | The design system named in the brief. Its definition was in the legacy `DESIGN.md` and is **unavailable** (OD-LC-2). | `X` |

### Pipeline and jobs

| Term | Definition | Tag |
| --- | --- | --- |
| **Research run** | One organization's work for one `run_date`. Unique per `(organization_id, run_date)`. | `S1` |
| **Signal job** | A bounded unit of pipeline work, leased by a worker. Carries the fields mandated by BR-JB-02. | `S1` |
| **Dispatch** | The act of creating or resuming runs and enqueuing jobs. Cron does this and nothing else. | `S1` |
| **Worker** | The component that claims and executes jobs. Not the cron callback. | `D` |
| **Lease** | A time-bounded claim on a job, expressed by `locked_at` / `locked_by`. Expiry enables stale recovery. | `S1` |
| **Idempotency key** | A unique key ensuring an operation happens at most once. Present on jobs and on payment events. | `S1` |
| **`PARTIAL`** | Job terminal state: some units succeeded, some failed. Distinct from `FAILED`. | `S1` |
| **Stale job** | A `RUNNING` job whose lease has expired. Automatically re-claimable. | `S1` |
| **Bounded batch** | A claim limited to a fixed number of units, so no invocation does unbounded work. | `S1` |

### Billing

| Term | Definition | Tag |
| --- | --- | --- |
| **Package** | A purchasable plan: key, display name, price, currency, interval. The authoritative price lives here. | `S1` + `D` |
| **Plan key** | The only purchase-related value a browser sends (`signal_lite` / `signal_pro` / `signal_elite`). | `S1` |
| **Payment event** | A raw provider webhook occurrence, uniquely keyed by `(provider, provider_event_id)`. The replay-protection ledger. | `D` |
| **Payment** | A normalized ledger row in the provider-neutral shape of BR-PM-09. | `S1` |
| **Internal order id** | Our identifier for a purchase, given to the provider. Stable across provider ids. | `S1` |
| **Settlement** | The idempotent act of recording a verified payment and updating entitlement. | `S1` |
| **Entitlement** | What an organization is allowed to use, derived from its package. Contents **undefined** (B-2). | `S1` (concept) / `X` (contents) |
| **Reconciliation** | The periodic convergence of internal payment state with provider truth. Runs every 5 minutes. | `S1` |
| **Read-back** | Server-side retrieval of a transaction from the provider, independent of the webhook. | `S1` |
| **Replay attack** | Re-delivery of a valid, previously-seen webhook to cause a duplicate effect. | `S1` |

### Authorization

| Term | Definition | Tag |
| --- | --- | --- |
| **Organization** | The tenant. Owns all tenant-scoped data and holds the access state. | `S1` |
| **Membership** | The link between a user and an organization, carrying a role. | `S1` |
| **Role** | `CUSTOMER`, `ADMIN`, or `SUPER_ADMIN`. Stored, explicit, server-owned. | `S1` |
| **Access state** | `PENDING_PAYMENT`, `PAYMENT_PROCESSING`, `PAID_ONBOARDING`, `ACTIVE`, `SUSPENDED`. Server-owned, on the organization. | `S1` |
| **Onboarding state** | Progress through onboarding; gates `PAID_ONBOARDING` surfaces. Criteria **undefined** (OD-BR-6). | `S1` (concept) / `X` (criteria) |
| **Tenant isolation** | The database invariant that a tenant can neither read nor write another tenant's rows. | `S1` |
| **Deny by default** | No policy means no access. A forgotten policy is a bug, not a leak. | `D` |
| **Privileged mutation** | Any state change affecting role, access state, payment, score, or evidence verification. Always audited. | `S1` |
| **Service role** | The Supabase role that bypasses RLS, used only inside Edge Functions. | `S1` |

## Security considerations

- Undefined terms are marked `X` deliberately. A glossary that quietly defines an undefined term
  creates the false impression that a decision was made.
- "Verified evidence", "published Signal", and "privileged mutation" are security-relevant terms:
  each corresponds to an enforcement point. Their definitions here are normative.

## Acceptance criteria

- [ ] Every domain term used in `docs/**` appears here.
- [ ] No term marked `X` is implemented before its definition is resolved.
- [ ] Code identifiers match these terms; a rename updates this file in the same commit.

## Related skills

- [`clean-code`](../SKILLS.md#clean-code) — one name per concept.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — naming as design.

## Open decisions

- Every `X` entry above corresponds to a row in [open-decisions](open-decisions.md).
