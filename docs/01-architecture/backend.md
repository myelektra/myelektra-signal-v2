# Backend Architecture

## Purpose

Define the server side: Edge Functions as the only place business logic runs, the layering inside
them, and the rules that keep privileged capability from leaking into untrusted context.

## Scope

In scope: function inventory, layering, the domain core, adapters, and error handling. Out of scope:
the schema ([schema](../02-database/schema.md)), policies ([rls](../02-database/rls.md)), and job
mechanics ([cron](../06-jobs/cron.md)).

## Source of truth

- `S1` Strategic brief — Supabase Edge Functions, the pipeline stages, server-side provider calls,
  server-side authorization, and the prohibition on business rules in React.
- `S4` Supabase Edge Function runtime documentation — must be verified (runtime, limits, cold starts).
- `D` Design decisions proposed here.

## Requirements

### R-BE-1 Function inventory `D`

Small, single-purpose functions. A monolithic handler would concentrate every secret and every
authorization decision in one place.

| Function | Trigger | Responsibility |
| --- | --- | --- |
| `signal-dispatch` | cron `0 3 * * *` | Create/resume runs, enqueue jobs. No pipeline work. |
| `signal-worker` | drain schedule (OD-JB-2) | Claim and execute bounded batches |
| `payment-reconciliation` | cron `*/5 * * * *` | Converge payment state with the provider |
| `checkout` | Customer | Resolve package from key, create the provider order/subscription |
| `paypal-webhook` | PayPal | Verify, dedupe, settle |
| `admin-*` | Admin | Control-plane actions, each explicitly authorized |

### R-BE-2 Layering `D`

```
entrypoint (HTTP handler)
  ├── extract identity from JWT
  ├── authorize the action              ← explicit, every request
  ├── parse and validate input           ← reject unknown fields
  └── call application service
        └── domain core (pure)            ← scoring, validation, dedup, state transitions
        └── adapters                      ← supabase, paypal, openai, mail
```

The domain core has **no I/O**. It takes data in and returns a decision or a value. This is what
makes it testable in milliseconds without a database, and it is why the brief's "unit tests before
integration" ordering is achievable.

### R-BE-3 Authorization on every request `S1`

Edge Functions run with the service role, which bypasses RLS. That capability is the reason
authorization cannot be implicit:

1. Extract the identity from the request JWT. Never trust a user id or organization id in the body.
2. Resolve membership and role from the database.
3. Check the action against the role.
4. Only then act.

A function that skips step 3 is exploitable by anyone who can read the frontend bundle and find the
endpoint name — which is everyone.

### R-BE-4 Input handling `S1`

- Unknown or forbidden fields in a privileged request are rejected with `400` and audited, not
  ignored ([R-PP-3](../05-billing/paypal.md#r-pp-3-what-the-browser-may-not-supply-s1)).
- All input is parsed against a schema at the boundary. Nothing downstream re-checks types.
- Tenant scope is derived from the JWT. A supplied `organization_id` is validated against the
  caller's memberships, and a mismatch returns `404`.

### R-BE-5 Errors `D`

| Situation | Client sees | Logs contain |
| --- | --- | --- |
| Validation failure | Typed code + which field | The same, no secrets |
| Not authorized | Typed code | Identity, action, and outcome |
| Cross-tenant attempt | `404` | Full detail — this is an attack signal |
| Provider failure | Typed code + retryable flag | Provider error text |
| Unexpected | Generic typed code | Full stack trace |

Stack traces never reach the client. Raw `Authorization` headers are never logged
([security-model R-SM-5](../07-security/security-model.md#r-sm-5-logging-and-observability-s1)).

### R-BE-6 Adapters `D`

One module per external provider, behind an interface. Rules:

- No provider SDK type crosses into the domain core. The core speaks domain types only.
- Secrets are read from Vault at call time, never captured at module load.
- Every provider call has a timeout and a bounded retry policy. An unbounded call in a cron-triggered
  function is how a run exceeds its wall clock.
- Provider responses are untrusted and validated before use.

### R-BE-7 No prohibited dependencies `S1`

No Convex, Mayar, Midtrans, or Stripe package appears in the dependency tree, transitively included.
No compatibility adapter exists for an absent system. Detection is automated
([legacy-carryover R-LC-4](legacy-carryover-decisions.md#r-lc-4-detection-d)).

## Security considerations

- **The service role is the highest-value secret in the system.** It bypasses RLS, so every control
  in [rls](../02-database/rls.md) is void inside a function. R-BE-3 is therefore not a best practice;
  it is the only thing standing between an authenticated user and every tenant's data.
- **Function-per-purpose limits blast radius.** A defect in `checkout` should not expose admin
  capability, which is why `admin-*` functions are separate.
- **Audit at the service layer**, not in handlers, so a new handler cannot forget it.
- **Provider responses are untrusted**, including error bodies, which are frequently reflected into
  logs and sometimes into UI.
- **Bounded timeouts and retries** prevent a slow provider from exhausting the function budget and
  leaving jobs permanently leased.

## Acceptance criteria

- [ ] The domain core has no import of any adapter or I/O module — enforced by lint.
- [ ] Every Edge Function authorizes explicitly before acting, verified per function by test.
- [ ] An unknown field in a privileged request yields `400` and an audit entry.
- [ ] A cross-tenant `organization_id` yields `404` and an audit entry.
- [ ] No stack trace appears in any client response.
- [ ] No raw auth header appears in any log line.
- [ ] Every provider call has an explicit timeout.
- [ ] `bun install` produces a dependency tree containing no prohibited package.

## Related skills

- [`clean-architecture`](../SKILLS.md#clean-architecture) — R-BE-2's layering.
- [`clean-code`](../SKILLS.md#clean-code) — boundaries that make the wrong thing unwritable.
- [`release-it`](../SKILLS.md#release-it) — timeouts, bulkheads, bounded retries.
- [`supabase`](../SKILLS.md#supabase) — Edge Function runtime and Vault.

## Open decisions

- **OD-BE-1** Whether `signal-worker` is a distinct function or an invocation mode of
  `signal-dispatch`. Recommend distinct (R-BE-1); needs approval with OD-JB-2.
- **OD-BE-2** Edge Function wall-clock and memory limits on the target project — determines the
  batch size in [cron R-CR-6](../06-jobs/cron.md#r-cr-6-parameters-d).
- **OD-BE-3** Structured logging format and destination.
- **OD-BE-4** Whether admin actions are one function with an action parameter or one function per
  action. Recommend per-action for authorization clarity.
