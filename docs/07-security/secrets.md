# Secrets

## Purpose

Specify where every secret lives, how it is read, how it is kept out of logs and bundles, and how it
is rotated.

## Scope

In scope: the secret inventory, storage, access, and rotation. Out of scope: authorization
([security-model](security-model.md)) and deployment topology
([deployment](../01-architecture/deployment.md)).

## Source of truth

- `S1` Strategic brief — Supabase Vault, no secret in the frontend bundle, no service-role key in the
  browser, no provider secret in a URL, no raw auth header in logs, no legacy secret reuse.
- `S4` Supabase Vault documentation — must be verified.
- `D` Rotation and inventory decisions proposed here.

## Requirements

### R-SE-1 Inventory `S1` + `D`

| Secret | Storage | Read by | In bundle |
| --- | --- | --- | --- |
| Supabase service-role key | Vault | Edge Functions only | **Never** |
| PayPal client secret (sandbox, live) | Vault | `checkout`, `paypal-webhook`, reconciliation | **Never** |
| PayPal webhook id | Vault | `paypal-webhook` | **Never** |
| PayPal access token | In-memory, per invocation | Any PayPal-calling function | **Never** |
| OpenAI API key | Vault | `signal-worker` | **Never** |
| Search provider key | Vault | `signal-worker` | **Never** |
| Email provider key | Vault | Delivery functions | **Never** |
| Cron invocation secret | Vault | `pg_cron` → dispatcher | **Never** |
| Supabase anon/public key | Vercel env, public-prefixed | SPA | Yes — **public by design** |
| PayPal client id (public) | Vercel env, public-prefixed | SPA (JS SDK) | Yes — **public by design** |

The last two are not secrets. Treating them as secrets leads to needless complexity; treating a real
secret as one of them leads to a leak. The distinction is enforced by naming: only explicitly
public-prefixed variables are inlined into the build.

### R-SE-2 Storage `S1`

All secrets live in Supabase Vault. Rules:

- **Read at call time, not at module load.** A secret captured at import is a secret held for the
  process lifetime and one that survives a rotation until restart.
- **Never written to disk, never committed.** No `.env` file containing a real secret is committed.
  A committed `.env.example` contains keys with empty values only.
- **No secret in a migration.** Migrations are committed and reviewed
  ([migrations R-MG-4](../02-database/migrations.md#r-mg-4-content-rules-d)).
- **Per-environment secrets.** A staging secret is never a production secret
  ([deployment R-DP-2](../01-architecture/deployment.md#r-dp-2-environments-d)).

### R-SE-3 Exposure controls `S1`

| Control | Enforces |
| --- | --- |
| Public-prefix convention | Only explicitly public variables are inlined by Vite |
| Bundle scan on build output | No secret pattern in the shipped artifact |
| Import-boundary lint | The SPA cannot import a module that reads Vault |
| Structural log redaction | The logger does not accept an auth header as a loggable field |
| No secrets in URLs | Secrets travel in headers or are read server-side; never in a query string |
| Error-message typing | Provider error bodies are not echoed to clients |

The bundle scan runs on **build output**, not only source. A secret can pass source review and still
land in a bundle through an environment-inlining mistake, which is precisely the failure mode source
scanning misses.

### R-SE-4 Logging `S1`

- The raw `Authorization` header is never logged. Redaction is **structural**: the logger has no path
  that accepts it. A regex applied after the fact fails on the first format variation.
- Payment request bodies are logged as amounts and identifiers, never as raw provider payloads
  outside `payment_events`.
- Job `last_error` may contain provider error text. It is admin-readable and never customer-readable.
- Access tokens never appear in a log, an error message, or a URL.

### R-SE-5 Rotation `D`

| Secret | Rotation |
| --- | --- |
| Service-role key | On any suspected exposure; otherwise per platform policy |
| PayPal secrets | On suspicion; live and sandbox independently |
| OpenAI / search keys | On suspicion |
| Cron invocation secret | With the service-role key |

Rules: rotation must not require a code change (Vault reads at call time make this true); a leaked
staging secret is rotated even though it is not production, because reuse across environments is what
turns a small leak into a large one; and **no legacy secret is reused** — every v2 credential is
newly issued ([legacy-carryover R-LC-3](../01-architecture/legacy-carryover-decisions.md#r-lc-3-legacy-artefacts-deliberately-left-behind-d)).

### R-SE-6 Leak response `D`

```
1. Rotate the affected secret immediately — before investigating
2. Determine the exposure window from audit logs and deployment history
3. Assess whether the exposure was exploited (payment events, access-state changes, cross-tenant reads)
4. Record the incident, the window, and the remediation
5. Add the detection that would have caught it earlier
```

Rotate first, investigate second. The investigation is not time-critical; the exposure is.

## Security considerations

- **The service-role key is the single point of total failure.** It bypasses RLS, so every control in
  [rls](../02-database/rls.md) is void wherever it is present. Its containment to Edge Functions is
  the highest-value control in this document.
- **Public-prefix discipline** is what makes the bundle safe by construction rather than by review.
- **Structural redaction over regex.** Regex redaction is a control that fails silently on the first
  unexpected format.
- **Per-environment isolation** bounds any single leak to one environment.
- **Not reusing legacy secrets** avoids importing an unknown exposure history — cheaper than
  establishing one.
- **A secret in a URL** ends up in browser history, server access logs, referrer headers, and
  analytics. That is why it is prohibited outright rather than discouraged.

## Acceptance criteria

- [ ] Every secret in R-SE-1 is in Vault, and none is committed to the repository.
- [ ] The bundle scan on build output finds no secret pattern.
- [ ] A full sandbox checkout produces no log line containing a secret, token, or raw auth header —
      asserted by test.
- [ ] No secret appears in any URL, verified by test over all provider calls.
- [ ] Only public-prefixed variables are inlined into the build, asserted by inspecting the artifact.
- [ ] Rotating a secret in Vault requires no code change or redeploy.
- [ ] `.env.example` contains keys with empty values only.

## Related skills

- [`supabase`](../SKILLS.md#supabase) — Vault usage and limits.
- [`release-it`](../SKILLS.md#release-it) — R-SE-6 incident response.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — automate the scan; don't rely on review.

## Open decisions

- **OD-SM-1** Which secret-scanning tool is standard.
- **OD-SE-1** Whether a commit-time secret scan runs in addition to the build-artifact scan.
  Recommended; both catch different mistakes.
- **OD-SE-2** Rotation cadence as policy rather than incident-driven.
- **OD-SE-3** Who holds Vault write access, and whether it requires `SUPER_ADMIN`.
