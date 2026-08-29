# myelektra-signal-v2

Ground-up rebuild of Myelektra Signal. Clean architecture on Supabase, PayPal, and Vercel — not an
incremental migration of the previous system.

```
Vercel  →  React / Vite / TypeScript SPA
             ↓  Supabase Auth
           Supabase PostgreSQL + RLS      (system of record; tenant isolation is a DB invariant)
             ↓
           Supabase Edge Functions        (all business logic, all provider calls)
             ↓
           PayPal / OpenAI / Search / Email
             ↑
           Supabase Cron (pg_cron)        (dispatcher, never worker)
```

## Status

**Phase 0 — APPROVED.** **Phase 1B (foundation) — `READY_FOR_REVIEW`.**

The documentation baseline is accepted and the foundation is on disk: the workspace, the SPA shell,
three placeholder packages, one Edge Function that proves the Deno import map, and the enforcement
toolchain. The plan is at
[`docs/01-architecture/foundation-plan.md`](docs/01-architecture/foundation-plan.md).

**No product behaviour exists.** There is no migration, table, RLS policy, auth flow, PayPal
integration, Signal engine, cron job, or dashboard — not as a stub either. The deferral table is
R-FN-11.

Start with [`docs/README.md`](docs/README.md).

### Important: the legacy repository is unavailable

Phase 0 required a forensic audit of `/home/user/myelektra-signal-saas`. **That repository is not
present in this workspace**, and `myelektra/myelektra-signal-saas` does not resolve on GitHub. The
audit therefore could not be performed, and every requirement in `docs/**` is tagged by provenance so
that a reader can always tell a briefed rule from an unknown one.

The source is **unresolved, not unrecoverable** — no permanence determination has been made.

|                                             |                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Audit of record                             | [`docs/00-product/forensic-audit.md`](docs/00-product/forensic-audit.md)                       |
| Authoritative gap register (all 20 targets) | [`docs/00-product/legacy-audit-gap-register.md`](docs/00-product/legacy-audit-gap-register.md) |
| Provisional assumptions — none approved     | [`docs/00-product/assumptions.md`](docs/00-product/assumptions.md)                             |
| Blockers and pending decisions              | [`docs/00-product/open-decisions.md`](docs/00-product/open-decisions.md)                       |

## Provenance tags

| Tag         | Meaning                                                         |
| ----------- | --------------------------------------------------------------- |
| `S1`        | Strategic brief for this rebuild — the only source in hand      |
| `S2` / `S3` | Legacy documentation / source code — **not available**          |
| `S4`        | Third-party provider documentation — verify before implementing |
| `D`         | Proposed design decision — needs approval                       |
| `X`         | Blocked. **Must not be invented.**                              |

## Documentation

| Area                                                          | Path                                             |
| ------------------------------------------------------------- | ------------------------------------------------ |
| Product, business rules, glossary, audit, open decisions      | [`docs/00-product/`](docs/00-product/)           |
| System, frontend, backend, deployment, carryover              | [`docs/01-architecture/`](docs/01-architecture/) |
| Schema, RLS, tenant isolation, migrations                     | [`docs/02-database/`](docs/02-database/)         |
| Authentication and authorization                              | [`docs/03-auth/`](docs/03-auth/)                 |
| Signal model, evidence, validation, dedup, scoring            | [`docs/04-signals/`](docs/04-signals/)           |
| PayPal, currency and cost policy, subscriptions, entitlements | [`docs/05-billing/`](docs/05-billing/)           |
| Cron, job lifecycle, idempotency                              | [`docs/06-jobs/`](docs/06-jobs/)                 |
| Security model, threat model, secrets                         | [`docs/07-security/`](docs/07-security/)         |
| Admin control plane                                           | [`docs/08-admin/`](docs/08-admin/)               |
| Homepage, customer dashboard, admin dashboard                 | [`docs/09-ui/`](docs/09-ui/)                     |
| Test strategy, RLS verification, production checklist         | [`docs/10-testing/`](docs/10-testing/)           |

## Repository layout

```
apps/web                     Layer 4 — SPA (Vite + React + TS)
  src/api/client.ts          the ONLY module allowed to import @supabase/supabase-js
  src/api/index.ts           the API surface everything else in apps/web imports
packages/domain              Layer 1 — pure TS. No I/O, no database, no provider SDK.
packages/contracts           Shared request/response shapes. The only package apps/web may import.
packages/adapters            Layer 2 — provider clients. Server-side only.
supabase/deno.json           Import map: Edge Functions -> shared TS source (strategy A, R-FN-12)
supabase/functions/spike     Proves the import map resolves at runtime. Not a product endpoint.
scripts/                     Enforcement: docs, USD-only, boundaries
.github/workflows/           CI quality gate
```

### Import boundary

```
apps/web  →  contracts  →  apps/web/src/api  →  Supabase Auth / Edge Function endpoint
```

`apps/web` may import `packages/contracts` and nothing else from the workspace. It may never import
`packages/domain` or `packages/adapters`, never import a provider SDK except the PayPal browser SDK
from `src/api/`, and never reference a server-only credential. Business rules do not run in React.

Enforced three independent ways, because a boundary held by one check gets crossed:

| Mechanism                                                    | How it fails a violation                                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module resolution                                            | Bun links only declared dependencies, so `apps/web/node_modules/@myelektra/` holds `contracts` alone — `import "@myelektra/domain"` is a `TS2307` |
| [`eslint.config.js`](eslint.config.js)                       | `no-restricted-imports`, `no-restricted-syntax`, `no-restricted-globals`                                                                          |
| [`scripts/check-boundaries.py`](scripts/check-boundaries.py) | Source scan; also catches `await import(...)` and `require(...)`                                                                                  |

## Toolchain

Bun is the repository-standard runner. These must pass:

```bash
bun install
bun tsc -b --noEmit
bun test
bun run lint
bun run build

deno check --config supabase/deno.json supabase/functions/**/index.ts
deno lint  supabase/functions
deno fmt --check supabase/deno.json supabase/functions

python3 scripts/check-docs.py
python3 scripts/check-usd-only.py
python3 scripts/check-boundaries.py
```

`.env.example` lists every variable with an empty value. Copy it to `apps/web/.env.local`. Only
`VITE_`-prefixed variables reach the bundle, and that prefix is a security boundary: adding one is a
decision to make a value public. Server-side secrets live in Supabase Vault and are never in Vercel.

## Prohibited

Convex and `@convex-dev/auth` · Mayar · Midtrans · Stripe in any path · Convex cron · browser cron ·
client-side secrets · public test or debug checkout endpoints · legacy migration compatibility
layers. Rationale and automated detection:
[`docs/00-product/legacy-exclusion-list.md`](docs/00-product/legacy-exclusion-list.md).
