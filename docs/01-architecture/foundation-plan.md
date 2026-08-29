# Foundation Plan (Phase 1A)

## Purpose

The plan for Phase 1 — the repository, toolchain, environment, deployment, CI, and enforcement
scaffolding. This document is the deliverable of **Phase 1A (planning only)**. No application code,
migration, policy, or integration is created by it.

## Scope

In scope: repository structure, the frontend/backend boundary, environment variables, Vercel and
Supabase configuration, the quality-gate toolchain, CI, USD-only enforcement, secret management, and
the explicit create/defer file lists.

Out of scope, and **explicitly not created in Phase 1**: database migrations, Supabase tables, RLS
policies, authentication flows, PayPal integration, the Signal engine, cron jobs, the customer
dashboard, and the admin dashboard. Each appears in the deferred list at R-FN-11.

## Source of truth

Every item below derives from an existing Phase 0 document. Nothing here introduces a new business
rule, and nothing resolves a blocked decision.

| Input | Section |
| --- | --- |
| [system-architecture R-SA-3](system-architecture.md#r-sa-3-dependency-rules-d) | Layering → repository structure |
| [backend R-BE-1](backend.md#r-be-1-function-inventory-d), [R-BE-2](backend.md#r-be-2-layering-d) | Function inventory, composition root |
| [frontend R-FE-5](frontend.md#r-fe-5-secrets-s1) | Public-prefix convention |
| [secrets R-SE-1](../07-security/secrets.md#r-se-1-inventory-s1--d) | Environment variable inventory |
| [deployment R-DP-2](deployment.md#r-dp-2-environments-d), [R-DP-3](deployment.md#r-dp-3-configuration-placement-s1) | Environments, configuration placement |
| [test-strategy R-TS-1](../10-testing/test-strategy.md#r-ts-1-runner-and-commands-s1) | The five required commands |
| [currency-and-cost-policy R-CU-6](../00-product/currency-and-cost-policy.md#r-cu-6-automated-enforcement-d) | USD-only enforcement |
| [legacy-exclusion-list R-LC-4](../00-product/legacy-exclusion-list.md#r-lc-4-detection-d) | Exclusion enforcement |
| [assumptions A-12, A-13](../00-product/assumptions.md) | Repository layout, worker split |

**Approval dependency.** The repository layout is [assumption A-12](../00-product/assumptions.md),
status `PROPOSED`. R-AS-4 forbids implementing an unapproved assumption. **Phase 1B cannot start
until A-12 is approved** — that is the first item requiring sign-off.

## Requirements

### R-FN-1 Repository structure `D` (A-12)

The four layers of [R-SA-3](system-architecture.md#r-sa-3-dependency-rules-d) map one-to-one onto
four locations, so that the dependency rule is a directory fact rather than a convention:

```
myelektra-signal-v2/
├── apps/
│   └── web/                      # Layer 4 — SPA (Vite + React + TS). Imports contracts only.
├── packages/
│   ├── domain/                   # Layer 1 — pure TS. No I/O, no imports from layers 2-4.
│   ├── contracts/                # Shared request/response types between SPA and functions.
│   └── adapters/                 # Layer 2 — provider clients behind interfaces.
├── supabase/
│   ├── functions/                # Layer 3 — entrypoints: composition roots only.
│   └── config.toml
├── scripts/                      # Enforcement: doc, currency, exclusion, bundle scans.
├── .github/workflows/            # CI.
├── docs/                         # Phase 0 baseline (exists).
└── README.md
```

Rationale for each:

| Location | Why it is separate |
| --- | --- |
| `packages/domain` | Must be testable in milliseconds with no database ([test-strategy R-TS-2](../10-testing/test-strategy.md#r-ts-2-test-layers-d)). Physical isolation is what makes "unit tests before integration" achievable. |
| `packages/contracts` | The SPA and the functions must agree on shapes. A shared package makes drift a type error rather than a runtime surprise. |
| `packages/adapters` | Keeps provider SDK types out of the domain core. Also unit-testable independently. |
| `supabase/functions` | Deno entrypoints. Composition roots only — thin by design, so authorization logic is reviewable in one place per function. |
| `scripts/` | The enforcement in R-FN-8 must be runnable locally and in CI identically. |

Bun workspaces with `apps/*` and `packages/*`. One lockfile, one `bun install`.

### R-FN-2 Frontend / backend boundary `S1`

Enforced three ways, because a boundary held only by review will be crossed:

| Mechanism | What it enforces |
| --- | --- |
| **TypeScript project references** | `apps/web` cannot resolve a path into `packages/domain` or `packages/adapters` |
| **ESLint import-boundary rule** | Fails the build on a forbidden import, with a message naming the rule |
| **Bundle scan** | Catches what the other two miss — a secret or service-role reference in build output |

**Amended.** The original rule — "`apps/web` imports `contracts` only" — was too strict. The SPA
must authenticate with Supabase and call Edge Functions, and a boundary that forbids that would
simply be bypassed in the first week. The corrected rule permits a browser-safe API path and forbids
everything privileged.

| Layer | May import |
| --- | --- |
| `packages/domain` | Nothing outside itself |
| `packages/contracts` | Nothing outside itself |
| `packages/adapters` | `domain`, `contracts`, server environment |
| `supabase/functions` | `domain`, `contracts`, `adapters` |
| `apps/web/src/api/**` | `contracts`, `@supabase/supabase-js`, the PayPal **JS SDK** loader |
| `apps/web/**` (everything else) | `contracts`, and `./api` only |

The approved request path is exactly:

```
apps/web  →  contracts  →  apps/web/src/api  →  Supabase Auth / Edge Function endpoint
```

Rules that make this safe:

| Rule | Enforcement |
| --- | --- |
| `@supabase/supabase-js` may be imported from **one module only**: `apps/web/src/api/client.ts` | ESLint `no-restricted-imports` with a path exception |
| That module is constructed with `VITE_SUPABASE_ANON_KEY` and **never** a service-role key | Lint + bundle scan + a runtime assertion in `client.ts` |
| Every other module in `apps/web` imports the API surface from `./api`, never a client directly | ESLint boundary rule |
| The PayPal JS SDK is loaded only in `apps/web/src/api/`, with the **public** client id | Same |

**Never importable from `apps/web`, in any module:**

| Forbidden | Why |
| --- | --- |
| `packages/domain` | Business rules must not run in the browser |
| `packages/adapters` | Server-only provider clients |
| Provider SDKs (PayPal server SDK, OpenAI, search, email) | Secrets and server-side calls |
| Any module referencing the service-role key | Total-compromise secret |
| Domain persistence implementations | Data access belongs behind the API boundary |

**On `@supabase/supabase-js` being a "database client".** It is one, and the prohibition is on
database clients *with privileged access*. Initialized with the anon key it is not privileged: every
query it makes is subject to RLS, which is precisely the control
[rls.md](../02-database/rls.md) specifies. What remains forbidden is using it to write protected
columns — those go through server-only RPCs
([schema R-DB-7](../02-database/schema.md#r-db-7-protected-fields-and-their-enforcement-s1--d)).

The narrowed rule still delivers the original intent: business rules never reach the browser, because
`packages/domain` is unimportable from `apps/web` and the API surface is the only door out.

### R-FN-3 Environment variable inventory `S1`

Derived from [secrets R-SE-1](../07-security/secrets.md#r-se-1-inventory-s1--d) and
[deployment R-DP-3](deployment.md#r-dp-3-configuration-placement-s1). The `VITE_` prefix is the
mechanism: Vite inlines **only** prefixed variables, so an unprefixed secret cannot reach the bundle
by accident.

**Client-side (Vercel, `VITE_`-prefixed, public by design):**

| Variable | Value | Note |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Project URL | Public |
| `VITE_SUPABASE_ANON_KEY` | Anon key | Public; RLS is the control, not this key |
| `VITE_PAYPAL_CLIENT_ID` | PayPal **public** client id | For the JS SDK only |
| `VITE_PAYPAL_ENV` | `sandbox` \| `live` | Per deployment, never request-driven |

**Server-side (Supabase Edge Functions / Vault — never in Vercel, never in the bundle):**

| Variable | Source | Read by |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Vault | Edge Functions only |
| `PAYPAL_CLIENT_SECRET_SANDBOX` | Vault | `checkout`, `paypal-webhook`, reconciliation |
| `PAYPAL_CLIENT_SECRET_LIVE` | Vault | Same, live only |
| `PAYPAL_WEBHOOK_ID` | Vault | `paypal-webhook` |
| `OPENAI_API_KEY` | Vault | `signal-worker` |
| `SEARCH_PROVIDER_API_KEY` | Vault | `signal-worker` |
| `EMAIL_PROVIDER_API_KEY` | Vault | Delivery functions |
| `CRON_INVOCATION_SECRET` | Vault | `pg_cron` → dispatcher |
| `APP_ENV` | Function env | `local` \| `preview` \| `staging` \| `production` |

**Local development:** `.env.example` with every key present and every value **empty**. The real
`.env` is git-ignored. A committed `.env.example` containing a value is a defect.

Phase 1A/1B creates only the **first four** plus `.env.example` and `APP_ENV`. The server-side rows
are documented now and provisioned when their consumer exists — creating a Vault entry for a PayPal
secret in Phase 1 would be provisioning an integration that Phase 1 forbids.

### R-FN-4 Vercel deployment plan `S1`

| Setting | Value |
| --- | --- |
| Root directory | `apps/web` |
| Framework preset | Vite |
| Build command | `bun run build` |
| Output directory | `dist` |
| Install command | `bun install` |
| Node/Bun runtime | Bun, per [test-strategy R-TS-1](../10-testing/test-strategy.md#r-ts-1-runner-and-commands-s1) |
| Serverless functions | **None.** Vercel hosts the frontend only |

| Environment | Branch | `VITE_PAYPAL_ENV` | Supabase project |
| --- | --- | --- | --- |
| Production | `main` | `live` | Production |
| Preview | any PR | `sandbox` | Preview/staging |

Rules carried from [deployment R-DP-2](deployment.md#r-dp-2-environments-d):

- Environment selection is **never request-driven**.
- **No public test or debug payment endpoint in any environment.** No Vercel route, rewrite, or
  serverless function may create one.
- Production credentials never exist in a non-production environment.

Phase 1A/1B configures the Vercel project and the build. It does **not** deploy a working product,
because there is nothing to deploy yet.

### R-FN-5 Supabase project configuration plan `S1`

One project per environment ([deployment R-DP-2](deployment.md#r-dp-2-environments-d)), so that a
staging compromise cannot expose production data.

| Item | Plan | Phase |
| --- | --- | --- |
| Projects: local, preview, staging, production | Created; no shared project | 1B |
| Extensions: `pgcrypto`, `pg_cron`, `pg_net` | Enable and verify | 1B |
| `pg_net` availability | **Verify — OD-JB-4.** If absent, the cron invocation mechanism changes | 1B |
| Vault | Enable; no secret entries until their consumer exists | 1B |
| Edge Function runtime | Confirm version, wall-clock and memory limits — **OD-BE-2** | 1B |
| API settings | Restrict origins to the Vercel domains | 1B |
| Auth providers | **Deferred — OD-AU-1 is blocked.** Sign-in methods are undecided | 2+ |
| Tables, RLS policies, triggers, grants | **Deferred to Phase 2** | 2 |
| Cron schedules | **Deferred to Phase 4** | 4 |
| PayPal configuration | **Deferred to Phase 7** | 7 |

The verification items matter more than the creation items. `pg_net` availability and the function
wall-clock limit both change the Phase 4 design, and discovering that in Phase 4 costs a redesign.

### R-FN-6 Testing / lint / typecheck / build plan `S1`

The five required commands, unchanged:

```bash
bun install
bun tsc -b --noEmit
bun test
bun run lint
bun run build
```

| Gate | Tool | Fails on |
| --- | --- | --- |
| Typecheck | `tsc -b --noEmit` with project references | Any type error, or a cross-boundary import |
| Lint | ESLint + import-boundary rule | Style, and any layer violation from R-FN-2 |
| Unit tests | `bun test` on `packages/domain` | Any failure |
| Build | `bun run build` | Any build error |
| Doc integrity | `scripts/check-docs` | Missing sections, broken links, stale naming |
| Currency scan | `scripts/check-currency` | R-FN-8 |
| Exclusion scan | `scripts/check-exclusions` | R-FN-8 |
| Bundle scan | Secret scanner on `apps/web/dist` | Any secret pattern in build output |

**Existing gap to close.** The documentation checker currently lives at `/home/user/check_docs.py`,
outside the repository. It verified the Phase 0 baseline but is not versioned and not runnable by
another contributor. Phase 1B ports it into `scripts/` so the gates are reproducible.

Integration, RLS, and end-to-end tests are **deferred** — they require a database
([test-strategy R-TS-2](../10-testing/test-strategy.md#r-ts-2-test-layers-d)) and the harness choice
is still open (OD-TS-1, OD-TS-2).

### R-FN-7 CI workflow plan `D`

GitHub Actions, one workflow, triggered on every pull request and on pushes to `main`.

```
job: verify
  1. setup bun
  2. bun install --frozen-lockfile
  3. bun tsc -b --noEmit          ── typecheck + boundary
  3b. deno check --config supabase/deno.json supabase/functions/**/index.ts
  3c. deno lint supabase/functions && deno fmt --check supabase
  4. bun run lint                 ── style + boundary
  5. bun test                     ── domain unit tests
  6. bun run build                ── produces dist
  7. scripts/check-docs           ── documentation integrity
  8. scripts/check-currency       ── USD-only
  9. scripts/check-exclusions     ── the providers in R-LC-1 + the currency ids in R-LC-5
 10. secret scan on dist + tree   ── build artifacts, not only source

job: preview (main only, after verify)
 11. Vercel preview deployment
```

Rules:

- Steps 3–10 are **required checks**. A branch that cannot run them is not mergeable
  ([test-strategy R-TS-1](../10-testing/test-strategy.md#r-ts-1-runner-and-commands-s1)).
- The secret scan runs on **build output**, because a secret can pass source review and still be
  inlined into a bundle.
- The workflow fails if a required check is **unavailable**, not only if it fails — the honesty rule
  from [test-strategy R-TS-6](../10-testing/test-strategy.md#r-ts-6-the-honesty-rule-s1).
- No job needs a database in Phase 1, so CI is fast and has no external service dependency.

### R-FN-8 USD-only validation plan `S1`

Implements [currency-and-cost-policy R-CU-6](../00-product/currency-and-cost-policy.md#r-cu-6-automated-enforcement-d)
and [legacy-exclusion-list R-LC-4](../00-product/legacy-exclusion-list.md#r-lc-4-detection-d) as
executable scripts.

| Script | Checks |
| --- | --- |
| `scripts/check-currency` | None of the currency identifiers in [R-LC-5](../00-product/legacy-exclusion-list.md#r-lc-5-excluded-currency-handling-s1) appears outside exclusion documentation, and none is defined as a schema field; every monetary column is named `*_usd`, is paired with `check (currency = 'USD')`, uses no floating-point type, and carries a non-negative amount check |
| `scripts/check-exclusions` | None of the excluded providers in [R-LC-1](../00-product/legacy-exclusion-list.md#r-lc-1-prohibited-technologies-s1) appears in source or in the dependency tree outside exclusion documentation |
| `scripts/check-docs` | Mandated files present, 8 sections per doc, links and anchors resolve, skill anchors resolve, no stale `*_cents` naming, no RLS policy described with column granularity |

The identifiers themselves are deliberately **not** restated here. They have one canonical home —
[legacy-exclusion-list](../00-product/legacy-exclusion-list.md) — and a second copy is a second place
to get out of sync. The scripts read from that list.

Phase 1 implements the **source, dependency, and documentation** checks. The **schema** checks are
written in Phase 1 but have nothing to scan until Phase 2 creates tables; they are implemented
against `supabase/migrations/*.sql` and will fail closed on an empty directory rather than pass
vacuously. That distinction matters — a scan that passes because there is nothing to scan is not a
passing check.

### R-FN-9 Secret management plan `S1`

| Control | Mechanism |
| --- | --- |
| Storage | Supabase Vault for every server-side secret; nothing in the repository |
| Local | `.env.example` with empty values; real `.env` git-ignored |
| Public/private split | The `VITE_` prefix, so only explicitly public values are inlined |
| Commit-time scan | Secret scanner over the working tree — **OD-SE-1** |
| Build-artifact scan | Secret scanner over `apps/web/dist` in CI |
| Log redaction | Structural, not regex — the logger has no path that accepts an auth header |
| Rotation | Read at call time, so rotating a Vault entry needs no code change or redeploy |
| Legacy secrets | **Never reused.** Every credential is newly issued |

Phase 1B creates `.env.example`, `.gitignore`, the scanner configuration, and the redaction
convention. It does **not** provision real secrets, because their consumers do not exist yet.

### R-FN-10 Foundation files to be created (Phase 1B)

Toolchain and structure only. Nothing in this list touches data, auth, or payments.

```
package.json                       workspace root, scripts for the five commands
bun.lockb                          lockfile
tsconfig.base.json                 shared compiler options
tsconfig.json                      project references
.gitignore                         .env, dist, node_modules
.env.example                       every key, every value empty
README.md                          updated: layout, commands, boundaries
AGENTS.md                          contributor rules, incl. the prohibition list

apps/web/package.json
apps/web/vite.config.ts
apps/web/tsconfig.json
apps/web/index.html
apps/web/src/main.tsx              mount point only
apps/web/src/App.tsx               placeholder shell — no screens
apps/web/src/api/client.ts         the ONLY module allowed to import @supabase/supabase-js
apps/web/src/api/index.ts          the API surface the rest of apps/web imports
apps/web/.eslintrc.cjs             boundary rules incl. the single-module supabase-js exception

packages/domain/package.json
packages/domain/tsconfig.json
packages/domain/src/index.ts       empty public surface

packages/contracts/package.json
packages/contracts/tsconfig.json
packages/contracts/src/index.ts    empty public surface

packages/adapters/package.json
packages/adapters/tsconfig.json
packages/adapters/src/index.ts     empty public surface

supabase/config.toml               project config; no migrations
supabase/deno.json                 the R-FN-12 import map (validated by the spike)
supabase/functions/spike/index.ts  the R-FN-12 validation function; dependency-free, no product logic

scripts/check-docs.ts              ported from the Phase 0 checker
scripts/check-currency.ts
scripts/check-exclusions.ts
scripts/secret-scan.sh

.github/workflows/ci.yml           the R-FN-7 workflow
```

Every `src/index.ts` is deliberately empty. Phase 1 proves the boundary and the toolchain work; it
does not pre-build domain surfaces whose shapes depend on blocked decisions.

### R-FN-11 Explicitly deferred

| Deferred to | Items |
| --- | --- |
| **Phase 2** | All migrations; all tables; all RLS policies; all `GRANT`/`REVOKE`; all triggers; `app.*` helper functions; organizations and memberships; the auth access guards; tenant-isolation tests |
| **Phase 2+** | Supabase Auth provider configuration (**blocked — OD-AU-1**) |
| **Phase 3** | Scoring, evidence validation, deduplication, structured validation (**blocked — B-3, B-4**) |
| **Phase 4** | `signal-dispatch`, `signal-worker`, cron schedules, job claiming, lease recovery |
| **Phase 5** | Homepage screens, customer dashboard, the design system (**blocked — OD-LC-2**) |
| **Phase 6** | Admin dashboard, Action Required queue, admin RPCs |
| **Phase 7** | PayPal client, `checkout`, `paypal-webhook`, reconciliation, Vault secret entries (**blocked — OD-PP-1**) |
| **Phase 8** | Security audit, RLS verification run, accessibility and performance review |

Nothing in the deferred list is created in Phase 1, including as a stub, placeholder, or empty
migration. A placeholder migration invites someone to fill it in before the schema decision is
approved, which is what the operating rule against premature migrations exists to prevent.

### R-FN-12 Bun/Deno sharing strategy — spike result `D`

OD-FN-1 asked whether `supabase/functions` can consume `packages/domain` and `packages/contracts`.
It was answered empirically rather than assumed. The spike ran outside the repository in a throwaway
tree and implemented no product feature, schema, migration, policy, auth, payment, cron, or screen.

**Environment used:** `deno 2.9.6 (stable, x86_64-unknown-linux-gnu, typescript 6.0.3)`, `bun 1.4.0`,
`node v22.22.3`. Deno was installed via `npm install -g deno` because `deno.land` is unreachable from
this sandbox.

**Spike contents:** one dependency-free domain function (`sumCents`), one contracts module
(`PingResponse`, `PING_PATH`), and one minimal Edge Function importing both.

| Variant | Result | Evidence |
| --- | --- | --- |
| **A — Deno import map to shared TS source** | **WORKS** | `deno check` exit 0; `deno run` served `{"path":"/ping","ok":true,"total":6}` |
| B — `nodeModulesDir` / node_modules resolution | **FAILS** | `TS2307: Import "@myelektra/domain" not a dependency` |
| C — copied `_shared` source | **WORKS, AND IS UNSAFE** | See below |
| Bare specifier with no import map | **FAILS** (negative control) | `TS2307` for both packages |

**Selected: Strategy A.** `supabase/deno.json` maps the bare specifiers to the shared TypeScript
source:

```json
{
  "imports": {
    "@myelektra/domain":    "../packages/domain/src/index.ts",
    "@myelektra/contracts": "../packages/contracts/src/index.ts"
  }
}
```

Three properties make A the right choice:

1. **One source of truth.** Deno reads the same `.ts` files Bun and `tsc` read. Nothing is generated,
   copied, or vendored.
2. **Types cross the boundary for real.** Introducing a deliberate type error produced
   `TS2322: Type 'string' is not assignable to type 'boolean'`, with the expected-type note pointing
   into `packages/contracts/src/index.ts`. Deno is checking the shared source, not a snapshot.
3. **No build step.** The packages expose `src/index.ts` directly, so there is no stale-output window.

**Why variant C is rejected — demonstrated, not asserted.** With a copied `_shared` tree, changing
`contracts` to require `ok: "YES" | "NO"` left the copy's `deno check` **still passing at exit 0**.
Divergence was completely undetected. That is the exact failure the operating rule against copying
business logic exists to prevent: two locations, no source of truth, and a green typecheck hiding the
drift.

**Two findings that changed the plan.** Bun created **no** `node_modules/@myelektra/` links, even
after `apps/web` declared `workspace:*` dependencies — so variant B was never viable. Bun does
nonetheless resolve workspace packages at runtime: a probe importing `@myelektra/contracts` from
`apps/web` printed `resolved: /ping`. The two runtimes resolve independently, which is exactly why
the import map is required rather than optional.

### R-FN-13 Validation commands `D`

Run in CI and locally. All four passed in the spike.

```bash
# Deno side — typecheck the Edge Function entrypoints against the shared source
deno check --config supabase/deno.json supabase/functions/**/index.ts
deno lint  supabase/functions
deno fmt --check supabase/functions supabase/deno.json

# Bun side — typecheck the workspace, including the same shared source
bun tsc -b --noEmit
```

Both sides typecheck `packages/domain` and `packages/contracts`. That redundancy is deliberate: `tsc`
enforces the browser-facing view and the project references, `deno check` enforces what the Edge
Function runtime will actually accept. A change that satisfies one and not the other is caught
before deploy.

### R-FN-14 Fallback if strategy A fails `D`

A is verified, but it rests on Deno resolving a relative path outside the function directory. If a
future Supabase deploy step rejects that — for example by uploading only `supabase/functions/` — the
fallback is **strategy C with enforced one-way generation**, not a hand-maintained copy:

```
1. packages/domain and packages/contracts stay the only source of truth.
2. A build step generates supabase/functions/_shared/ from them.
3. _shared/ is git-ignored and never edited by hand.
4. CI regenerates it and fails if the committed tree differs — so drift becomes a red build
   rather than a silent divergence.
```

The distinction from the rejected variant C is the generated-and-verified part. The spike showed that
a *copied* tree diverges silently; a *generated* tree that CI re-derives and compares cannot.

Trigger for the fallback: any `supabase functions deploy --dry-run` or bundle step that fails to
resolve `../packages/*`. Until that is observed, A stands.

### R-FN-15 A-12 approval `S1`

The repository layout in R-FN-1 — `apps/web`, `packages/domain`, `packages/contracts`,
`packages/adapters`, `supabase/functions` — is **APPROVED**. It was accepted because it preserves the
intended dependency direction and separates frontend, domain rules, contracts, adapters, and Supabase
server functions. [Assumption A-12](../00-product/assumptions.md) moves from `PROPOSED` to `APPROVED`,
which clears the R-AS-4 block on Phase 1B.

## Security considerations

- **The `VITE_` prefix is the bundle-safety mechanism**, not a naming preference. An unprefixed
  variable is not inlined; a prefixed one is. The inventory in R-FN-3 is therefore a security
  boundary, and adding a variable to it is a security decision.
- **The service-role key never reaches Vercel.** It lives in Vault and is read inside Edge Functions.
  Its presence in `apps/web/dist` fails CI.
- **No secret is provisioned before its consumer exists.** An unused credential in Vault is an
  unmonitored credential.
- **Scans run on build output**, because inlining mistakes are invisible in source review.
- **Schema scans fail closed on an empty migrations directory.** A vacuous pass is not a pass.
- **The boundary lint is a security control**, not a style rule: it is what keeps scoring, pricing,
  and access logic out of code that ships to the browser.
- **No debug or test payment route** is created in Phase 1, and the route-inventory check will catch
  one later.

## Acceptance criteria

Phase 1B is complete when:

- [ ] A-12 is approved (**done** — R-FN-15) and the layout in R-FN-1 exists on disk.
- [ ] The R-FN-13 commands pass in CI: `deno check`, `deno lint`, `deno fmt --check`, `bun tsc -b --noEmit`.
- [ ] The spike function resolves both shared packages through `supabase/deno.json` and runs.
- [ ] `@supabase/supabase-js` is imported from `apps/web/src/api/client.ts` and nowhere else — asserted by lint.
- [ ] A deliberate import of `packages/domain` from `apps/web` fails `tsc` **and** `lint`.
- [ ] All five commands pass on a clean checkout, locally and in CI.
- [ ] A deliberate cross-boundary import in `apps/web` fails both `tsc` and `lint`.
- [ ] `bun install` resolves with no prohibited dependency, including transitive.
- [ ] `scripts/check-currency`, `scripts/check-exclusions`, and `scripts/check-docs` run in CI and pass.
- [ ] The schema scans fail closed when `supabase/migrations/` is empty.
- [ ] The secret scan runs on `apps/web/dist` and finds nothing.
- [ ] `.env.example` contains every key with an empty value; no real `.env` is committed.
- [ ] No file from the R-FN-11 deferred list exists.
- [ ] The Vercel project builds the SPA and serves a placeholder shell.
- [ ] `pg_net` availability and the Edge Function limits are recorded, resolving OD-JB-4 and OD-BE-2.
- [ ] No production-readiness claim is made.

## Related skills

- [`clean-architecture`](../SKILLS.md#clean-architecture) — the layer boundary in R-FN-1 and R-FN-2.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — automate every prohibition.
- [`release-it`](../SKILLS.md#release-it) — CI gates that block a merge.
- [`supabase`](../SKILLS.md#supabase) — project, Vault, and Edge Function configuration.
- [`clean-code`](../SKILLS.md#clean-code) — empty public surfaces until there is something to expose.

## Open decisions

Resolved by this amendment:

- **A-12 / OD-SA-1** — **APPROVED** (R-FN-15). Phase 1B is unblocked.
- **OD-FN-1** — **RESOLVED** by spike (R-FN-12). Strategy A: Deno import map to shared TypeScript
  source. Variant B fails (`TS2307`); variant C works but diverges silently and is rejected.

Needed during Phase 1B:

- **OD-JB-4** — is `pg_net` enabled? Verified by inspecting the project.
- **OD-BE-2** — Edge Function wall-clock and memory limits, which set the Phase 4 batch size.
- **OD-SE-1** — which secret scanner is standard.
- **OD-TS-1 / OD-TS-2** — SQL harness and CI database. Not needed in Phase 1, but the choice affects
  whether `bun test` stays database-free.

Raised by this plan:

- **OD-FN-2** — ESLint flat config versus legacy config, and the specific boundary plugin.
- **OD-FN-3** — Whether preview deployments share one staging Supabase project or use per-PR branching
  (same subject as OD-DP-1, OD-MG-2).
