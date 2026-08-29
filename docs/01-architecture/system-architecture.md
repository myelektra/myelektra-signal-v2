# System Architecture

## Purpose

Define the v2 system boundary, the components inside it, the direction of every dependency, and the
reason each technology was chosen. This document is the answer to "what is the system", and it is
deliberately a replacement rather than a migration of the legacy architecture.

## Scope

In scope: component inventory, trust boundaries, data flow, dependency rules, and the explicit
non-goals inherited from the strategic decision. Out of scope: table definitions
([schema](../02-database/schema.md)), policy text ([rls](../02-database/rls.md)), and deploy
mechanics ([deployment](deployment.md)).

## Source of truth

- `S1` Strategic brief (2026-08-29) — the stack decision, the runtime diagram, the prohibition list.
- `S2`/`S3` Legacy documentation and code — **not available**; see
  [forensic-audit](../00-product/forensic-audit.md). No legacy structure informed this design.
- `D` Design decisions proposed here, requiring approval.

## Requirements

### R-SA-1 Target runtime `S1`

```
Vercel
  └── React / Vite SPA            (presentation only — no business rules, no secrets)
        ↓  HTTPS + Supabase JWT
Supabase Auth                     (identity)
        ↓
Supabase PostgreSQL + RLS         (system of record; tenant isolation is a DB invariant)
        ↓
Supabase Edge Functions           (all business logic, all provider calls)
        ↓
PayPal / OpenAI / Search / Email  (external providers, server-side only)
        ↑
Supabase Cron (pg_cron)           (scheduler — dispatcher, never worker)
```

### R-SA-2 Component inventory `S1`

| Component | Runtime | Owns | Must never |
| --- | --- | --- | --- |
| SPA | Vercel | Rendering, routing, form state, optimistic UI | Compute scores, decide access, hold secrets, call providers |
| Supabase Auth | Supabase | Identity, sessions, JWT issuance | Store business state beyond `auth.users` |
| PostgreSQL + RLS | Supabase | All persistent state, all authorization at the row level | Be written to by a client with a scope the client chose |
| Edge Functions | Supabase | Signal pipeline, checkout orchestration, webhook handling, admin control plane | Trust a client-supplied price, role, or tenant |
| pg_cron | Supabase | Dispatch timing | Perform work inline |
| Vault | Supabase | Provider secrets | Be readable from the browser or logged |

### R-SA-3 Dependency rules `D`

Dependencies point inward. Violations are architecture bugs, not style issues.

1. **Domain core** (pure TypeScript, no I/O): scoring, evidence validation, deduplication,
   quota arithmetic, state transitions. Depends on nothing.
2. **Adapters**: Supabase client, PayPal client, OpenAI client, mail client. Depends on domain
   core only through interfaces.
3. **Edge Function entrypoints**: composition root. Wires adapters to the domain core, extracts the
   authenticated identity, authorizes, then calls in.
4. **SPA**: depends on the Supabase JS client and on HTTP contracts. It must not import anything
   from layers 1–3.

### R-SA-4 Trust boundaries `S1`

| Boundary | Crossing | Rule |
| --- | --- | --- |
| Browser → Vercel | Static assets | Nothing sensitive is in the bundle. |
| Browser → Supabase | JWT + RLS | Client is untrusted for scope, price, role, and state. RLS is the gate for **rows**; column-level fields (`price_usd`, `role`, `access_state`, `score`) are guarded by `REVOKE`, triggers, and `CHECK` constraints — see [schema R-DB-6](../02-database/schema.md#r-db-6-what-rls-does-and-does-not-protect-s1). |
| Browser → Edge Function | HTTPS + JWT | Function re-authorizes server-side; it never trusts the route that called it. |
| PayPal → Edge Function | Webhook | Signature verification + replay protection before any state change. USD only; no currency is taken from the provider or the client. |
| Edge Function → cost ledger | USD cost entries | Every paid provider call is recorded in USD cents, attributed to an organization and a job. |
| Edge Function → providers | HTTPS + Vault secret | Secrets are read at call time, never embedded, never logged. |
| pg_cron → Edge Function | Internal invocation | Service-scoped; carries no user identity and therefore grants none. |

### R-SA-5 Signal data flow `S1`

```
pg_cron (0 3 * * *)
  → signal-dispatch            creates/resumes research_runs, enqueues signal_jobs
  → signal-process             claims jobs under lease
      candidate discovery
      cheap filtering          (reject before spending model tokens)
      AI validation
      structured validation
      evidence verification
      deduplication
      deterministic scoring    (domain core — pure)
      persist signals
      build daily read model
      delivery
```

Ordering is normative. Cheap filtering precedes AI validation specifically so that cost is spent
only on candidates that survive the inexpensive tests.

### R-SA-6 Explicit non-goals `S1`

The following are architectural prohibitions, not preferences. Any pull request introducing one
must be rejected at review:

| Prohibited | Reason |
| --- | --- |
| Convex, `@convex-dev/auth`, Convex cron | Replaced wholesale by Supabase. A second backend reintroduces the mixed architecture this rebuild exists to remove. |
| Mayar | Replaced by PayPal. No Mayar adapter, client, or config. |
| Midtrans | Not a v2 provider. |
| Stripe, in any path including legacy | PayPal is the sole customer checkout provider. |
| Browser cron / client-scheduled work | The daily run must not depend on a browser being open. |
| Client-side secrets | Any secret in the bundle is a leaked secret. |
| Public test/debug checkout action | Absolute, all environments. |
| Legacy migration compatibility layer | No Mayar customers or production payment data require migration. |
| IDR, FX rates, currency conversion | USD is the only currency. See [currency-and-cost-policy](../00-product/currency-and-cost-policy.md). |

The full exclusion list, with automated detection for each entry, is
[legacy-exclusion-list](../00-product/legacy-exclusion-list.md).

### R-SA-7 Failure posture `D`

| Failure | Required behaviour |
| --- | --- |
| Edge Function crashes mid-run | Jobs stay leased until the lease expires, then are recovered. No Signal is half-published. |
| Provider outage | Job goes `FAILED` or run goes `PARTIAL`; already-published Signals remain readable. |
| Webhook arrives before read-back completes | Reconciliation cron resolves it within 5 minutes. |
| Database unreachable from SPA | SPA renders a failed/retryable state; it must not render empty-as-if-no-data. |
| Duplicate cron fire | Run-uniqueness constraint rejects the second run. |

## Security considerations

- Authorization is enforced twice: RLS for data access, Edge Function checks for actions. Neither is
  optional and neither is a substitute for the other. See [security-model](../07-security/security-model.md).
- The SPA is treated as hostile input. Every claim it makes is re-derived server-side.
- pg_cron invocations carry no user identity and must therefore grant none; a cron-triggered
  function cannot act "as a customer".
- No component in this architecture has a reason to see another tenant's rows. Cross-tenant access
  is a bug by construction, not a policy question.

## Acceptance criteria

- [ ] No code path in the SPA imports domain-core or adapter modules.
- [ ] `grep` for `convex`, `mayar`, `midtrans`, `stripe` across the repository returns nothing but
  documentation of the prohibition.
- [ ] Every Edge Function resolves identity and authorization before touching data.
- [ ] The daily run can be interrupted at any stage and resumed without duplicating Signals.
- [ ] The dependency rule R-SA-3 is enforced by a lint rule or a boundary test, not by convention.

## Related skills

- [`system-design`](../SKILLS.md#system-design) — component boundaries and failure posture.
- [`clean-architecture`](../SKILLS.md#clean-architecture) — the dependency rule in R-SA-3.
- [`release-it`](../SKILLS.md#release-it) — R-SA-7 failure posture.
- [`supabase`](../SKILLS.md#supabase) — platform capability boundaries.

## Open decisions

- **OD-SA-1** Monorepo layout: single package with workspace boundaries, or separate
  `apps/web` + `packages/domain` + `supabase/functions`? Affects the lint-enforced boundary in
  R-SA-3. Tagged `D`.
- **OD-SA-2** Which search provider(s) back candidate discovery, and what the per-run token/cost
  ceiling is. The brief names "search provider" generically. Tagged `X`.
- **OD-SA-3** Whether the daily read model is a materialized view or a table populated by the
  pipeline. Tagged `D`.
- **OD-SA-4** Whether OpenAI calls are batched per organization or per candidate; drives cost
  predictability. Tagged `D`.
