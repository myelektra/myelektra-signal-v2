# Myelektra Signal v2 — Documentation

This is the Phase 0 documentation baseline for the ground-up rebuild of Myelektra Signal on
Supabase + PayPal + Vercel. It is a **design record**, not a description of running software: no
code, schema, or migration exists yet.

## Read this first

| Document | Why |
| --- | --- |
| [00-product/legacy-audit-gap-register.md](00-product/legacy-audit-gap-register.md) | **The authoritative gap register.** The legacy source could not be resolved; all 20 mandated audit targets are statused here. |
| [00-product/forensic-audit.md](00-product/forensic-audit.md) | The audit of record, and the evidence for why it could not be performed. |
| [00-product/business-rules.md](00-product/business-rules.md) | The normative rule register, with provenance on every rule. |
| [00-product/assumptions.md](00-product/assumptions.md) | Provisional positions taken without a fully authorizing source. **None is approved by default.** |
| [00-product/open-decisions.md](00-product/open-decisions.md) | Everything unresolved, with blocking status. |
| [01-architecture/legacy-carryover-decisions.md](01-architecture/legacy-carryover-decisions.md) | What is deliberately not carried over. |

## Provenance

Every requirement in this documentation set carries a tag. A requirement without a tag does not exist.

| Tag | Meaning | Available |
| --- | --- | --- |
| `S1` | Strategic brief for the v2 rebuild (2026-08-29) | **Yes — the only source in hand** |
| `S2` | Legacy documentation (`docs/product/*`, `DESIGN.md`, `AGENTS.md`, `SKILLS.md`, `docs/contracts/*`) | **No** |
| `S3` | Legacy source code | **No** |
| `S4` | Third-party provider documentation (Supabase, PayPal, OpenAI) | Not fetched; verify before implementing |
| `D` | Design decision proposed by this rebuild — needs approval | Yes |
| `X` | Blocked. Unknown. **Must not be invented.** | — |

The reason this system exists: the brief forbids inventing pricing, quotas, or payment lifecycle
behaviour. The legacy repository could not be resolved in this workspace, so a large part of that
behaviour is genuinely unknown, and the only honest response is to mark it rather than fill it in.

The four registers are distinct and an item lives in exactly one of them:

| Register | Holds | May be implemented? |
| --- | --- | --- |
| [business-rules](00-product/business-rules.md) | Rules grounded in the brief (`S1`) | Yes |
| [assumptions](00-product/assumptions.md) | Provisional positions (`PROPOSED`) | **No — not until approved** |
| [legacy-audit-gap-register](00-product/legacy-audit-gap-register.md) | Unknowns (`X`) | **No** |
| [open-decisions](00-product/open-decisions.md) | The queue that resolves both | — |

## Document map

### 00-product

| Document | Contents |
| --- | --- |
| [product-requirements.md](00-product/product-requirements.md) | Product definition, actors, catalog, content rules |
| [business-rules.md](00-product/business-rules.md) | The normative rule register |
| [glossary.md](00-product/glossary.md) | One definition per term |
| [forensic-audit.md](00-product/forensic-audit.md) | The audit of record and the evidence behind its status |
| [legacy-audit-gap-register.md](00-product/legacy-audit-gap-register.md) | Authoritative status of all 20 mandated audit targets |
| [assumptions.md](00-product/assumptions.md) | Provisional positions, their invalidation triggers, and approval status |
| [open-decisions.md](00-product/open-decisions.md) | Blockers, pending decisions, and the assumptions queue |

### 01-architecture

| Document | Contents |
| --- | --- |
| [system-architecture.md](01-architecture/system-architecture.md) | Components, trust boundaries, dependency rules, non-goals |
| [frontend.md](01-architecture/frontend.md) | SPA responsibilities and limits |
| [backend.md](01-architecture/backend.md) | Edge Functions, layering, the pure domain core |
| [deployment.md](01-architecture/deployment.md) | Environments, release order, rollback |
| [legacy-carryover-decisions.md](01-architecture/legacy-carryover-decisions.md) | What is not carried over, and how that is enforced |

### 02-database

| Document | Contents |
| --- | --- |
| [schema.md](02-database/schema.md) | Entities, keys, constraints, invariants |
| [rls.md](02-database/rls.md) | Deny-by-default policies, helpers, the policy matrix |
| [tenant-isolation.md](02-database/tenant-isolation.md) | The invariant, violation vectors, enforcement stack |
| [migrations.md](02-database/migrations.md) | Forward-only, expand-then-contract |

### 03-auth

| Document | Contents |
| --- | --- |
| [authentication-authorization.md](03-auth/authentication-authorization.md) | Identity, roles, access states, the resolution sequence |

### 04-signals

| Document | Contents |
| --- | --- |
| [signal-model.md](04-signals/signal-model.md) | The Signal, the publication gate, immutability |
| [evidence.md](04-signals/evidence.md) | Evidence as first-class; verification as privileged |
| [validation.md](04-signals/validation.md) | Cheap filtering, AI validation, structured validation |
| [deduplication.md](04-signals/deduplication.md) | Tenant-scoped dedup; duplicate vs material update |
| [scoring.md](04-signals/scoring.md) | Weights, bands, determinism, and the undefined components |

### 05-billing

| Document | Contents |
| --- | --- |
| [paypal.md](05-billing/paypal.md) | Checkout, webhooks, replay protection, settlement |
| [currency-and-cost-policy.md](05-billing/currency-and-cost-policy.md) | USD-only rules, and the cost-control mechanism with its numbers withheld |
| [subscriptions.md](05-billing/subscriptions.md) | Lifecycle, and which behaviours remain undefined |
| [entitlements.md](05-billing/entitlements.md) | Derivation, enforcement, and the undecided quotas |
| [reconciliation.md](05-billing/reconciliation.md) | Converging with provider truth; escalate, don't auto-reverse |

### 06-jobs

| Document | Contents |
| --- | --- |
| [cron.md](06-jobs/cron.md) | Schedules, the dispatcher/worker split, observability |
| [job-lifecycle.md](06-jobs/job-lifecycle.md) | States, leases, retry, stale recovery |
| [idempotency.md](06-jobs/idempotency.md) | Keys, insert-then-act, provider-scoped uniqueness |

### 07-security

| Document | Contents |
| --- | --- |
| [security-model.md](07-security/security-model.md) | The 14 mandated gates, the trust model, defence layers |
| [threat-model.md](07-security/threat-model.md) | 25 threats, their controls, and residual risk |
| [secrets.md](07-security/secrets.md) | Inventory, Vault, exposure controls, rotation |

### 08-admin

| Document | Contents |
| --- | --- |
| [admin-control-plane.md](08-admin/admin-control-plane.md) | Action inventory, authorization, audit, mutation safety |

### 09-ui

| Document | Contents |
| --- | --- |
| [homepage.md](09-ui/homepage.md) | Hero/guide frame, CTAs, catalog, content prohibitions |
| [customer-dashboard.md](09-ui/customer-dashboard.md) | Nine surfaces, the six-section Signal detail |
| [admin-dashboard.md](09-ui/admin-dashboard.md) | Action Required first; recoverable errors |

### 10-testing

| Document | Contents |
| --- | --- |
| [test-strategy.md](10-testing/test-strategy.md) | Layers, the mandated checks, the honesty rule |
| [rls-verification.md](10-testing/rls-verification.md) | The per-table, per-role, both-directions matrix |
| [production-checklist.md](10-testing/production-checklist.md) | The release gate and its current state |

### Reference

| Document | Contents |
| --- | --- |
| [SKILLS.md](SKILLS.md) | Skill index — the resolution point for every `Related skills` link |

## Conventions

- Every document has: Purpose, Scope, Source of truth, Requirements, Security considerations,
  Acceptance criteria, Related skills, Open decisions.
- Requirement ids are `R-<area>-<n>`; business rule ids are `BR-<area>-<n>`; open decisions are
  `OD-<id>`; blockers are `B-<n>`. An id is stable; renaming one is a breaking change to reviews.
- `Related skills` entries link to anchors in [SKILLS.md](SKILLS.md), never to nonexistent paths.
- Resolving an open decision updates the register in the same commit.

## Status

**Phase 0 only.** No feature implementation has begun, per the operating rule that the documentation
baseline is written and reviewed first. See
[production-checklist](10-testing/production-checklist.md#current-state) for the honest state.
