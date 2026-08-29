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

**Phase 0 — documentation baseline.** No application code, schema, or migration exists yet. This is
deliberate: the operating rule is that the documentation baseline is written and reviewed before
feature implementation starts.

Start with [`docs/README.md`](docs/README.md).

### Important: the legacy repository is unavailable

Phase 0 required a forensic audit of `/home/user/myelektra-signal-saas`. **That repository is not
present in this workspace**, and `myelektra/myelektra-signal-saas` does not resolve on GitHub. The
audit therefore could not be performed, and every requirement in `docs/**` is tagged by provenance so
that a reader can always tell a briefed rule from an unknown one.

The source is **unresolved, not unrecoverable** — no permanence determination has been made.

| | |
| --- | --- |
| Audit of record | [`docs/00-product/forensic-audit.md`](docs/00-product/forensic-audit.md) |
| Authoritative gap register (all 20 targets) | [`docs/00-product/legacy-audit-gap-register.md`](docs/00-product/legacy-audit-gap-register.md) |
| Provisional assumptions — none approved | [`docs/00-product/assumptions.md`](docs/00-product/assumptions.md) |
| Blockers and pending decisions | [`docs/00-product/open-decisions.md`](docs/00-product/open-decisions.md) |

## Provenance tags

| Tag | Meaning |
| --- | --- |
| `S1` | Strategic brief for this rebuild — the only source in hand |
| `S2` / `S3` | Legacy documentation / source code — **not available** |
| `S4` | Third-party provider documentation — verify before implementing |
| `D` | Proposed design decision — needs approval |
| `X` | Blocked. **Must not be invented.** |

## Documentation

| Area | Path |
| --- | --- |
| Product, business rules, glossary, audit, open decisions | [`docs/00-product/`](docs/00-product/) |
| System, frontend, backend, deployment, carryover | [`docs/01-architecture/`](docs/01-architecture/) |
| Schema, RLS, tenant isolation, migrations | [`docs/02-database/`](docs/02-database/) |
| Authentication and authorization | [`docs/03-auth/`](docs/03-auth/) |
| Signal model, evidence, validation, dedup, scoring | [`docs/04-signals/`](docs/04-signals/) |
| PayPal, currency and cost policy, subscriptions, entitlements | [`docs/05-billing/`](docs/05-billing/) |
| Cron, job lifecycle, idempotency | [`docs/06-jobs/`](docs/06-jobs/) |
| Security model, threat model, secrets | [`docs/07-security/`](docs/07-security/) |
| Admin control plane | [`docs/08-admin/`](docs/08-admin/) |
| Homepage, customer dashboard, admin dashboard | [`docs/09-ui/`](docs/09-ui/) |
| Test strategy, RLS verification, production checklist | [`docs/10-testing/`](docs/10-testing/) |

## Planned toolchain

Bun is the repository-standard runner. Once Phase 1 scaffolding lands, these must pass:

```bash
bun install
bun tsc -b --noEmit
bun test
bun run lint
bun run build
```

## Prohibited

Convex and `@convex-dev/auth` · Mayar · Midtrans · Stripe in any path · Convex cron · browser cron ·
client-side secrets · public test or debug checkout endpoints · legacy migration compatibility
layers. Rationale and automated detection:
[`docs/00-product/legacy-exclusion-list.md`](docs/00-product/legacy-exclusion-list.md).
