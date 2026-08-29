# Database Schema

## Purpose

Specify the v2 data model as a design derived from product requirements, together with the
constraints that make tenant isolation and payment integrity enforceable at the database layer.

## Scope

In scope: entities, keys, constraints, and the invariants they express. Out of scope: policy text
([rls](rls.md)), migration sequencing ([migrations](migrations.md)), and business-rule rationale
([business-rules](../00-product/business-rules.md)).

## Source of truth

- `S1` Strategic brief — the conceptual model (the entity list below), the tenant invariants, the
  provider-neutral payment shape, the job field list, the access states, the job states.
- `S2`/`S3` Legacy migrations and models — **not available**. No legacy column was carried over.
- `D` Column-level design proposed here. Requires approval before migration authoring, per the
  operating rule *"do not create database migrations before documenting the schema decision."*

## Requirements

### R-DB-1 Conceptual model `S1`

```
auth.users
  ↓ (identity)
organizations
  ↓
organization_members
  ├── monitoring_profiles
  ├── existing_buyers
  ├── monitored_accounts
  ├── research_runs
  ├── signal_jobs
  ├── signals
  │     └── signal_evidence
  ├── opportunities
  ├── contacts
  ├── delivery_config
  ├── delivery_attempts
  ├── notifications
  ├── usage
  ├── subscriptions
  ├── payments
  └── audit_logs
```

Two additions are required to satisfy `S1` requirements that the conceptual list alone cannot:

| Addition | Why |
| --- | --- |
| `packages` | BR-PK-05: the authoritative price must live in the database so the Edge Function can resolve it. Also backs the admin "Packages" screen. See [pricing](../05-billing/pricing.md). |
| `cost_entries` | BR-PM-16/17: OpenAI, search, and email costs must be recorded in USD and attributed, so COGS and margin are computable per organization. |
| `payment_events` | BR-PM-06/07: webhook idempotency and replay protection require a durable record of every provider event received, keyed by provider event id. |

### R-DB-2 Universal invariants `S1`

| ID | Invariant | Enforcement |
| --- | --- | --- |
| INV-1 | Every tenant-owned row has a non-null `organization_id` referencing `organizations`. | `NOT NULL` + `FOREIGN KEY` |
| INV-2 | A customer cannot read or write another tenant's rows. | RLS — see [rls](rls.md) |
| INV-3 | A customer cannot change role. | No `UPDATE` policy on `organization_members.role`; RLS |
| INV-4 | A customer cannot change payment or access state. | Column-level `GRANT` denial + no `UPDATE` policy on the columns |
| INV-5 | A customer cannot change a final Signal score. | No `UPDATE` policy on `signals` for `CUSTOMER` |
| INV-6 | A customer cannot mark evidence verified. | No `UPDATE` policy on `signal_evidence.verified_*` for `CUSTOMER` |
| INV-7 | Admin access is server-authorized. | Edge Function check before any privileged call |
| INV-8 | Privileged mutations are recorded. | Trigger-maintained `audit_logs`, append-only |
| INV-9 | Payment provider references are provider-scoped. | Composite uniqueness on `(provider, …)` |
| INV-10 | There is no single global `transaction_id`. | The column does not exist; see `payments` below |

### R-DB-3 Core entities `D`

**`organizations`** — the tenant and the billing subject.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid pk default gen_random_uuid()` | |
| `name` | `text not null` | |
| `access_state` | `text not null default 'PENDING_PAYMENT'` | `check` in the five states of BR-AC-01 |
| `onboarding_state` | `text not null default 'NOT_STARTED'` | BR-AC-04; enumeration is `X` (BR-AC-06) |
| `package_id` | `uuid null → packages.id` | Null until a subscription settles |
| `created_at` / `updated_at` | `timestamptz not null` | |

**`organization_members`** — membership and role.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid pk` | |
| `organization_id` | `uuid not null → organizations.id on delete cascade` | INV-1 |
| `user_id` | `uuid not null → auth.users.id on delete cascade` | |
| `role` | `text not null` | `check (role in ('CUSTOMER','ADMIN','SUPER_ADMIN'))` — BR-RB-01 |
| `created_at` | `timestamptz not null` | |
| — | `unique (organization_id, user_id)` | One membership row per user per org |

**`packages`** — authoritative catalog.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid pk` | |
| `key` | `text not null unique` | `signal_lite` / `signal_pro` / `signal_elite` — the only thing the browser sends (BR-PM-03) |
| `display_name` | `text not null` | BR-PK-01 |
| `price_cents` | `integer not null check (price_cents > 0)` | 1900 / 4900 / 9900 |
| `currency` | `text not null default 'USD' check (currency = 'USD')` | BR-PK-02 — constrained, not conventional |
| `billing_interval` | `text not null default 'MONTH'` | BR-PK-03 |
| `is_active` | `boolean not null default true` | Retire a plan without breaking history |
| `provider_plan_id` | `text null` | PayPal plan id; provider-scoped, see R-DB-5 |
| `limits` | `jsonb not null default '{}'` | **Values are `X`** — BR-PK-06. The column exists; the numbers do not. |

> The `limits` column is deliberately empty in the baseline. Populating it requires resolving
> OD-BR-1. Shipping guessed quotas would violate *"do not invent pricing, quotas, or payment
> lifecycle behavior."*

**`signals`** — the product's core row.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid pk` | |
| `organization_id` | `uuid not null` | INV-1 |
| `run_id` | `uuid not null → research_runs.id` | Provenance |
| `account_id` | `uuid null → monitored_accounts.id` | |
| `signal_type` | `text not null` | Taxonomy is `X` — BR-SG-07 |
| `subject_name` | `text not null` | Company/event — BR-SG-02 |
| `summary` | `text not null` | Evidence summary |
| `commercial_implication` | `text not null` | BR-SG-02 |
| `recommended_action` | `text not null` | BR-SG-02 |
| `confidence` | `text not null` | BR-SG-02; enumeration `D` |
| `freshness` | `text not null` | BR-SG-02; enumeration `D` |
| `published_at` | `timestamptz null` | Null = not published. BR-SG-03's *source* publication date is on evidence |
| `source_published_at` | `timestamptz null` | Present "jika tersedia" — absence must stay visible (BR-SG-03) |
| `limitations` | `text null` | BR-SG-04 |
| `score` | `integer not null check (score between 0 and 100)` | BR-SC-15 — reject, never clamp |
| `score_band` | `text not null` | `check in ('HIGH','MEDIUM','WATCH','LOW')`; derived at write (BR-SC-14) |
| `score_components` | `jsonb not null` | Exactly the six keys of BR-SC-02…07; validated by a `check` |
| `created_at` | `timestamptz not null` | |

`score_components` is validated so that a persisted Signal can never be missing a component the UI
is required to display:

```sql
check (
  score_components ?& array[
    'account_fit','signal_strength','freshness',
    'buyer_relevance','commercial_scale','evidence_quality'
  ]
)
```

**`signal_evidence`** — makes BR-EV-01 mechanically true.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid pk` | |
| `organization_id` | `uuid not null` | INV-1 |
| `signal_id` | `uuid not null → signals.id on delete cascade` | |
| `source_name` | `text not null` | BR-EV-02 |
| `source_url` | `text not null` | BR-EV-02 |
| `evidence_summary` | `text not null` | |
| `is_verified` | `boolean not null default false` | BR-EV-05 |
| `verified_by` | `uuid null → auth.users.id` | BR-EV-04 |
| `verified_at` | `timestamptz null` | BR-EV-04 |
| `created_at` | `timestamptz not null` | |

Publication gate (BR-SG-01) is enforced in the database, not in application code:

```sql
-- a published signal must have at least one verified evidence row
create or replace function app.assert_signal_has_verified_evidence() ...
-- fired BEFORE UPDATE OF published_at ON signals WHEN (new.published_at is not null)
```

A constraint this important must not be defeatable by a code path that forgets to check.

**`payments`** — provider-neutral ledger, shape mandated by BR-PM-09.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid pk` | Internal identity |
| `internal_order_id` | `uuid not null unique` | Our id, given to the provider |
| `organization_id` | `uuid not null` | INV-1. The brief's `customer_id` resolves to the tenant. |
| `provider` | `text not null check (provider = 'PAYPAL')` | BR-PM-01. Enum keeps the door open without opening it. |
| `provider_order_id` | `text null` | BR-PM-09 |
| `provider_transaction_id` | `text null` | BR-PM-09 |
| `provider_subscription_id` | `text null` | BR-PM-09 |
| `package_id` | `uuid not null → packages.id` | What was bought, resolved server-side |
| `amount_cents` | `integer not null check (amount_cents > 0)` | Never from the client (BR-PM-03) |
| `currency` | `text not null default 'USD' check (currency='USD')` | BR-PM-02 |
| `status` | `text not null` | Internal settlement status; mapping from provider status is `X` (BR-SB-04) |
| `paid_at` | `timestamptz null` | BR-PM-09 |
| `metadata` | `jsonb not null default '{}'` | BR-PM-09 |
| `created_at` / `updated_at` | `timestamptz not null` | |

Provider-scoped uniqueness, satisfying INV-9 and INV-10:

```sql
create unique index payments_provider_order_uq
  on payments (provider, provider_order_id)        where provider_order_id        is not null;
create unique index payments_provider_txn_uq
  on payments (provider, provider_transaction_id)  where provider_transaction_id  is not null;
create unique index payments_provider_sub_uq
  on payments (provider, provider_subscription_id) where provider_subscription_id is not null;
```

Partial indexes are used because a PayPal order exists before its transaction does; a plain unique
constraint on nullable columns would permit the duplicates the brief forbids while still rejecting
the legitimate nulls.

**`payment_events`** — the replay-protection ledger.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid pk` | |
| `provider` | `text not null` | |
| `provider_event_id` | `text not null` | Provider's own event identifier |
| `event_type` | `text not null` | |
| `received_at` | `timestamptz not null default now()` | |
| `occurred_at` | `timestamptz null` | Provider-reported time; feeds the replay window |
| `payload` | `jsonb not null` | Raw, for audit |
| `processed_at` | `timestamptz null` | |
| `payment_id` | `uuid null → payments.id` | Link established on settlement |
| — | `unique (provider, provider_event_id)` | **This constraint is the idempotency guarantee** (BR-PM-06). A replay fails to insert and is therefore a no-op. |

**`cost_entries`** — provider spend, append-only, USD only.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint generated always as identity pk` | |
| `organization_id` | `uuid not null` | INV-1 — attribution to the tenant that caused the spend |
| `job_id` | `uuid null → signal_jobs.id` | Attribution to the unit of work; null for non-pipeline spend |
| `provider` | `text not null` | `OPENAI` / `SEARCH` / `EMAIL` / other named provider |
| `amount_cents` | `integer not null check (amount_cents >= 0)` | **USD cents** — BR-PM-16, BR-PM-18 |
| `currency` | `text not null default 'USD' check (currency = 'USD')` | BR-PM-02 — explicit, not implied |
| `units` | `integer null check (units >= 0)` | Tokens, queries, or messages consumed |
| `unit_label` | `text null` | What `units` counts |
| `created_at` | `timestamptz not null default now()` | |

Append-only, like `audit_logs`: `UPDATE` and `DELETE` are revoked and a trigger raises. An editable
cost history is an editable profit statement. COGS is the sum of these rows for a period; margin is
USD revenue minus that sum ([currency-and-cost-policy](../00-product/currency-and-cost-policy.md)).

No `amount_idr`, `fx_rate`, or `exchange_rate` column exists in this schema, and none may be added
([legacy-exclusion-list R-LC-5](../00-product/legacy-exclusion-list.md#r-lc-5-excluded-currency-handling-s1)).

**`signal_jobs`** — fields mandated verbatim by BR-JB-02.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid pk` | |
| `organization_id` | `uuid not null` | INV-1 |
| `run_id` | `uuid not null → research_runs.id` | |
| `job_type` | `text not null` | |
| `status` | `text not null default 'QUEUED'` | `check in ('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED')` — BR-JB-01 |
| `attempt_count` | `integer not null default 0` | |
| `available_at` | `timestamptz not null default now()` | Backoff target — BR-JB-07 |
| `locked_at` | `timestamptz null` | Lease start — BR-JB-05 |
| `locked_by` | `text null` | Worker identity — BR-JB-05 |
| `last_error` | `text null` | |
| `idempotency_key` | `text not null` | BR-JB-04; `unique` |
| `created_at` | `timestamptz not null` | |
| `completed_at` | `timestamptz null` | |

Supporting index for the claim query, which is the hottest path in the system:

```sql
create index signal_jobs_claimable_idx
  on signal_jobs (available_at, id)
  where status in ('QUEUED','FAILED');
```

**`research_runs`** — duplicate-run prevention (BR-JB-09).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid pk` | |
| `organization_id` | `uuid not null` | INV-1 |
| `run_date` | `date not null` | |
| `status` | `text not null` | Run-level lifecycle |
| `started_at` / `completed_at` | `timestamptz null` | |
| — | `unique (organization_id, run_date)` | **Duplicate run prevention.** A double-fired cron cannot create a second run. |

**`usage`** — quota accounting.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid pk` | |
| `organization_id` | `uuid not null` | INV-1 |
| `period_start` / `period_end` | `date not null` | |
| `metric` | `text not null` | |
| `quantity` | `integer not null default 0 check (quantity >= 0)` | |
| — | `unique (organization_id, period_start, metric)` | One counter per metric per period |

> Which metrics exist is `X` (BR-PK-06). The counter mechanism is designed; the metric list is not
> invented.

**`audit_logs`** — append-only (BR-RB-04, BR-RB-05).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `bigint generated always as identity pk` | Monotonic; supports "what happened after X" |
| `organization_id` | `uuid null` | Null for platform-scope events |
| `actor_id` | `uuid null` | Null for system/cron actors — recorded as system, not attributed |
| `actor_role` | `text null` | Role at the time of the act |
| `action` | `text not null` | |
| `entity_type` | `text not null` | |
| `entity_id` | `text null` | |
| `before` / `after` | `jsonb null` | |
| `created_at` | `timestamptz not null default now()` | |

Append-only is enforced by revoking `UPDATE`/`DELETE` from every non-owner role and by a
`BEFORE UPDATE OR DELETE` trigger that raises.

**Remaining entities** — `monitoring_profiles`, `existing_buyers`, `monitored_accounts`,
`opportunities`, `contacts`, `delivery_config`, `delivery_attempts`, `notifications`,
`subscriptions`. Each carries `id`, `organization_id` (INV-1), timestamps, and FKs. Their business
columns are gated on blocked rules: `delivery_config`/`delivery_attempts` on BR-DL-03,
`notifications` on BR-DL-04, `subscriptions` on BR-SB-04, `existing_buyers` on an undocumented
legacy concept whose purpose cannot be recovered without `S3`.

### R-DB-4 Referential integrity `S1`

- Every FK is declared; none is implied by naming convention.
- `on delete cascade` only where the child is meaningless without the parent (`organization_members`,
  `signal_evidence`). Everything else restricts, so history survives.
- Every enumeration is a `check` constraint, not a comment.
- Every uniqueness requirement in this document is an index, not an application-side check.

### R-DB-5 Provider scoping `S1`

No column in this schema is named `transaction_id`, `order_id`, or `subscription_id` without a
`provider_` prefix and a sibling `provider` column. This is INV-9/INV-10 expressed as a naming rule
that a reviewer can check mechanically.

## Security considerations

- Constraints are the last line of defence. RLS decides *who* may act; constraints decide *what is
  representable*. A schema that permits an invalid state will eventually contain one.
- `check (currency = 'USD')` on both `packages` and `payments` makes BR-PM-02 unfalsifiable at the
  storage layer, independent of any code review.
- Column-level `GRANT` denial is used alongside RLS for `access_state`, `role`, and `score`, so that
  a policy mistake does not immediately become a privilege escalation.
- `audit_logs.before`/`after` may contain PII. They must never be logged elsewhere, and their
  retention needs a decision (OD-DB-3).
- `payment_events.payload` stores raw provider bodies. It must not be echoed to the client.

## Acceptance criteria

- [ ] Every tenant-owned table has `organization_id not null` with a declared FK.
- [ ] RLS is enabled on every tenant-owned table; verified by the check in [rls-verification](../10-testing/rls-verification.md).
- [ ] No column named `transaction_id` without a `provider_` prefix exists anywhere.
- [ ] Publishing a Signal with zero verified evidence rows raises a constraint error.
- [ ] Inserting a duplicate `(provider, provider_event_id)` raises a uniqueness violation.
- [ ] Inserting a second `research_runs` row for the same `(organization_id, run_date)` raises.
- [ ] `packages.limits` is `{}` in the baseline, with a comment pointing at OD-BR-1.
- [ ] Writing a `score` of 101 or -1 is rejected.

## Related skills

- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) — indexing,
  constraints, and identity strategy.
- [`supabase`](../SKILLS.md#supabase) — `auth.users`, Vault, pg_cron availability.
- [`ddia-systems`](../SKILLS.md#ddia-systems) — idempotency keys and exactly-once semantics.
- [`clean-architecture`](../SKILLS.md#clean-architecture) — the schema is the persistence boundary.

## Open decisions

- **OD-DB-1** Whether `score_components` should be six typed columns instead of `jsonb`. Typed
  columns are queryable and constrainable per component; `jsonb` is simpler to evolve while the
  taxonomy is `X`. Tagged `D`.
- **OD-DB-2** `confidence` and `freshness` enumerations. Tagged `X` — depends on BR-SC-22/BR-SC-25.
- **OD-DB-3** Retention for `audit_logs` and `payment_events.payload`. Tagged `X`.
- **OD-DB-4** The purpose and columns of `existing_buyers`. Named in the brief's conceptual model;
  its semantics are not recoverable without the legacy repository. Tagged `X`.
- **OD-DB-5** Whether `usage` counts per calendar period or per subscription period. Tagged `D`.
