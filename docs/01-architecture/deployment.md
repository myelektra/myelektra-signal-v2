# Deployment

## Purpose

Define how each component is deployed, what configuration each environment holds, and how a release
is verified and rolled back.

## Scope

In scope: environments, hosting, configuration placement, release sequence, and rollback. Out of
scope: architecture ([system-architecture](system-architecture.md)) and secret mechanics
([secrets](../07-security/secrets.md)).

## Source of truth

- `S1` Strategic brief — Vercel for the frontend only, Supabase for everything else, sandbox and live
  PayPal configuration, controlled live verification.
- `S4` Vercel and Supabase documentation — must be verified.
- `D` Design decisions proposed here.

## Requirements

### R-DP-1 Topology `S1`

| Component | Host | Notes |
| --- | --- | --- |
| SPA | Vercel | Static build. No server logic. |
| Database, RLS, cron, Vault | Supabase | One project per environment |
| Edge Functions | Supabase | Deployed with the project |
| PayPal | PayPal | Sandbox and live are separate configurations |

Vercel hosts the frontend **only**. Any server-side computation placed on Vercel would split the
backend across two platforms and recreate the mixed architecture this rebuild removes.

### R-DP-2 Environments `D`

| Environment | Database | PayPal | Purpose |
| --- | --- | --- | --- |
| Local | Local Supabase | Sandbox (or mocked) | Development, tests |
| Preview | Ephemeral/branch | Sandbox | Per-PR verification |
| Staging | Dedicated project | Sandbox | Pre-release verification, including webhooks |
| Production | Dedicated project | Live | Customers |

Rules:

- **Environment selection is never request-driven** (BR-PM-14). A request cannot cause a production
  function to use sandbox credentials or the reverse.
- **No public test or debug payment endpoint exists in any environment** (BR-PM-13). Sandbox testing
  uses the real flow against PayPal sandbox.
- **Production credentials never exist in a non-production environment.**

### R-DP-3 Configuration placement `S1`

| Value | Location |
| --- | --- |
| Provider secrets, service-role key, webhook id | Supabase Vault |
| Public Supabase key, PayPal public client id | Vercel env, explicitly public-prefixed |
| Environment selector | Server env var, set per deployment |
| Cron schedules | Database (`cron.job`), created by migration |
| Package prices | Database (`packages`), never in the bundle |

Prices living in the database means a price change is a data change with an audit trail, not a
frontend deploy.

### R-DP-4 Release sequence `D`

```
1. CI: install, typecheck, test, lint, build, secret scan        ← all must pass
2. Migrations applied to the target project (forward-only)
3. Edge Functions deployed
4. Cron schedules verified present in cron.job
5. SPA deployed to Vercel
6. Smoke: sign in, read a gated surface, confirm denial for an ungated one
7. Payment smoke (staging): full sandbox checkout + webhook + reconciliation
```

**Migrations precede functions, functions precede the SPA.** The inverse order creates a window where
the client calls an endpoint that does not exist, or a function reads a column that does not.

### R-DP-5 Rollback `D`

| Layer | Rollback |
| --- | --- |
| SPA | Vercel instant rollback to the previous deployment |
| Edge Functions | Redeploy the previous version |
| Database | **Not automatically reversible.** Migrations are forward-only; reversal is a new forward migration |
| Cron | Disable via `cron.unschedule`; re-enable after |

Because the database cannot be rolled back, migrations must be **expand-then-contract**: add the new
column, deploy code that writes both, migrate reads, then drop. A migration that renames or drops a
column in the same release as the code that stops using it makes rollback impossible.

### R-DP-6 Live payment cutover `S1` + `D`

Controlled, per [paypal R-PP-9](../05-billing/paypal.md#r-pp-9-live-verification-d): sandbox
end-to-end, one real low-value transaction by a known internal buyer, verify ledger and entitlement
and audit and log cleanliness, reverse it, then enable. Not a flag flip.

### R-DP-7 Observability in production `D`

Every signal in [cron R-CR-8](../06-jobs/cron.md#r-cr-8-observability-d) must be visible in
production from day one. A deployment that cannot answer "did today's run happen?" is not a
deployment that can be operated.

## Security considerations

- **Separate Supabase projects per environment** means a staging compromise does not expose
  production data. Shared projects with row-level environment flags do not provide this.
- **Environment selection is server-side and request-independent** (R-DP-2), closing the
  sandbox-credentials-in-production class of failure.
- **Forward-only migrations with expand-then-contract** keep rollback possible, which is a security
  property: an insecure release that cannot be rolled back is an incident with no exit.
- **No debug payment endpoint anywhere.** A staging-only endpoint is reachable from the internet and
  is a payment-bypass candidate.
- **Secrets are per-environment and never shared**, so a leaked staging credential does not become a
  production credential.

## Acceptance criteria

- [ ] All five quality-gate commands pass in CI before any deploy.
- [ ] The secret scan runs on the Vercel build output and fails the build on any hit.
- [ ] Migrations, functions, and SPA deploy in the R-DP-4 order, verified by the pipeline definition.
- [ ] Staging completes a full sandbox checkout including webhook and reconciliation.
- [ ] No route matching a test/debug checkout pattern exists in any deployed environment.
- [ ] A production request cannot select the sandbox configuration, asserted by test.
- [ ] Rolling back the SPA to the previous deployment leaves the system functional.
- [ ] `cron.job` contains both required schedules after deployment.

## Related skills

- [`release-it`](../SKILLS.md#release-it) — staged rollout, rollback, and expand-then-contract.
- [`supabase`](../SKILLS.md#supabase) — project and Vault layout.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — automate the sequence, don't document it.

## Open decisions

- **OD-DP-1** Branch-per-PR preview databases: Supabase branching, or a shared staging project.
- **OD-DP-2** How PayPal webhooks reach staging. Local tunneling exposes an endpoint publicly, which
  conflicts with the spirit of R-DP-2; a staged deploy target may be required.
- **OD-DP-3** Domain, DNS, and email sending domain configuration.
- **OD-DP-4** Monitoring and alerting provider for R-DP-7 (shared with OD-JB-5).
