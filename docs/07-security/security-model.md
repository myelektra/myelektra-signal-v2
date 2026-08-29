# Security Model

## Purpose

State the security guarantees the system makes, the controls that deliver each one, and the
verification that proves the control exists. This document is the gate that Phase 8 measures
against.

## Scope

In scope: the control set, the trust model, and the completion criteria. Out of scope: enumerated
attack scenarios ([threat-model](threat-model.md)) and secret mechanics ([secrets](secrets.md)).

## Source of truth

- `S1` Strategic brief — the security requirements checklist reproduced verbatim in R-SM-1, plus the
  invariants in [business-rules](../00-product/business-rules.md).
- `D` Control design proposed here.

## Requirements

### R-SM-1 Mandated completion criteria `S1`

Each item below is a hard gate. "Implementation is not complete" until every row is verified, and a
check that cannot be run is documented as a limitation rather than silently skipped.

| # | Requirement | Control | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | No secret in frontend bundle | Secrets never imported by SPA code; Vault-only server reads | Build-artifact secret scan | Gate |
| 2 | No service-role key in browser | Service key referenced only in Edge Functions | Bundle scan + import-boundary lint | Gate |
| 3 | No provider secret in URL | Secrets passed via headers/Vault, never query strings | Log + URL redaction test | Gate |
| 4 | No raw auth header in logs | Structural redaction in the logging layer | Log-redaction unit test | Gate |
| 5 | No public test/debug payment endpoint | No such route exists in any environment | Route inventory assertion | Gate |
| 6 | No client-controlled tenant scope | Scope derived from JWT; supplied ids validated against it | Tenant-isolation tests | Gate |
| 7 | No client-controlled price | Price read from `packages` server-side | Checkout contract test | Gate |
| 8 | No client-controlled access state | Column `GRANT` denial + no RLS `UPDATE` policy | RLS verification | Gate |
| 9 | No cross-tenant reads | RLS deny-by-default + per-table policies | RLS verification, both directions | Gate |
| 10 | No cross-tenant writes | Same as above, write policies | RLS verification | Gate |
| 11 | Webhook replay protection | `unique (provider, provider_event_id)` + timestamp window | Replay test, sequential and concurrent | Gate |
| 12 | Payment idempotency | Provider-scoped uniqueness + insert-then-act settlement | Idempotency test | Gate |
| 13 | RLS verification | Automated per-table, per-role matrix | [rls-verification](../10-testing/rls-verification.md) | Gate |
| 14 | Audit logging for privileged mutations | Trigger-maintained append-only `audit_logs` | Audit-completeness test | Gate |

### R-SM-2 Trust model `S1`

| Actor | Trust level | Consequence |
| --- | --- | --- |
| Browser / SPA | **Untrusted** | Every claim re-derived server-side. Route hiding is presentation only. |
| Authenticated customer | Trusted for *identity* only | Not trusted for role, scope, price, or state. |
| Edge Function (service role) | Trusted, and bypasses RLS | Must authorize explicitly on every request. Its trust is the largest risk in the system. |
| PayPal webhook | Untrusted until verified | No state change before signature verification. |
| pg_cron | Trusted to trigger, grants nothing | Carries no user identity; cannot act as a customer. |
| External model/search providers | Untrusted content | Output is validated structurally before persistence; never executed, never rendered as HTML. |

### R-SM-3 Defence layers `D`

| Layer | Question it answers | Failure mode if absent |
| --- | --- | --- |
| SPA route guard | What should we render? | Confusing UI. **Not** a security failure. |
| Edge Function authorization | May this identity perform this action? | Privileged action by any authenticated user |
| RLS | Which rows may this JWT touch? | Cross-tenant data access |
| Column `GRANT` | Which fields may this role write? | Escalation via a permitted row update |
| Constraints | Is this state representable at all? | Invalid data that no code path intended |
| Audit log | What happened, and who did it? | Unattributable privileged change |

Each layer is necessary. The design intent is that a defect in one layer is caught by another: a
missing RLS policy still meets a column `GRANT` denial; a wrong `GRANT` still meets a constraint.

### R-SM-4 Input trust rules `S1`

- No value affecting money, role, tenant, or access state is read from a request body, query string,
  or header without server-side re-derivation.
- Unrecognized fields in a privileged request are rejected with `400` and audited, not ignored
  ([R-PP-3](../05-billing/paypal.md#r-pp-3-what-the-browser-may-not-supply-s1)).
- Cross-tenant access returns `404`, not `403`, to avoid an existence oracle
  ([R-AU-6](../03-auth/authentication-authorization.md#r-au-6-denial-contract-d)).
- Provider-sourced content (search results, model output) is treated as untrusted data: validated
  against a schema, length-bounded, and rendered as text.

### R-SM-5 Logging and observability `S1`

- The raw `Authorization` header is never logged. Redaction is structural — the logger does not
  accept the header as a loggable field — rather than a regex applied after the fact.
- Request bodies for payment endpoints are logged with amounts and identifiers only, never with
  provider payloads verbatim outside `payment_events`.
- `last_error` on jobs may contain provider error text. It is admin-readable and never
  customer-readable ([rls](../02-database/rls.md#r-rl-3-policy-matrix-s1--d)).
- Errors returned to clients are typed codes. Stack traces and SQL fragments never reach the browser.

### R-SM-6 Prohibited constructs `S1`

| Prohibited | Detection |
| --- | --- |
| `convex`, `@convex-dev/auth` | Dependency scan |
| `mayar`, `midtrans` | Dependency + source scan |
| `stripe` in any path | Dependency + source scan |
| Service-role key outside `supabase/functions` | Import-boundary lint |
| `SUPABASE_SERVICE_ROLE_KEY` in any client-side file | Bundle scan |
| Client cron / `setInterval`-driven scheduled work | Source review |
| Public test/debug checkout route | Route inventory assertion |
| Legacy migration compatibility layer | Architecture review |

Detection must be automated. A prohibition enforced only by review will eventually be broken by
someone who never read this document.

## Security considerations

- **The service role is the crown jewel.** It bypasses RLS entirely. Every control in this document
  assumes it stays inside Edge Functions. A single leak converts a tenant-isolated system into an
  open one, which is why requirements 1 and 2 are separate gates rather than one.
- **Deny-by-default is the load-bearing decision.** Permissive fallback policies turn "we forgot a
  policy" into a data breach. Deny-by-default turns it into a bug report.
- **Re-derivation beats validation.** Checking that a client-supplied `organization_id` matches the
  JWT is weaker than never reading it. Where the server can derive a value, it derives it.
- **Audit logs are evidence, not telemetry.** Append-only enforcement (BR-RB-05) is what makes them
  admissible when investigating an incident.
- **Cost amplification is a security concern here.** Unbounded batches against paid model and search
  APIs make a triggered cron run an invoice. Bounded batches
  ([R-CR-5](../06-jobs/cron.md#r-cr-5-required-behaviours-s1)) are therefore a security control.
- **Untrusted content from AI providers** is a prompt-injection surface: a scraped page could attempt
  to steer extraction. Structural validation and the evidence gate are the mitigations; model output
  is never treated as an instruction.

## Acceptance criteria

- [ ] Every row of R-SM-1 has a passing automated check, or a documented limitation naming exactly
      what could not be run and why.
- [ ] The secret scan runs on build artifacts, not only on source.
- [ ] The import-boundary lint fails the build if the SPA imports a domain-core or adapter module.
- [ ] The prohibition scan in R-SM-6 runs in CI and fails on any hit.
- [ ] A full sandbox checkout produces no log line containing a secret, token, or raw auth header.
- [ ] The RLS verification matrix passes for every tenant-owned table in both directions.
- [ ] No production-readiness claim is made while any R-SM-1 row is unverified.

## Related skills

- [`system-design`](../SKILLS.md#system-design) — defence in depth and trust boundaries.
- [`release-it`](../SKILLS.md#release-it) — gates that block a release.
- [`supabase`](../SKILLS.md#supabase) — RLS, Vault, service-role semantics.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — automate the prohibitions.

## Open decisions

- **OD-SM-1** Which secret-scanning tool is standard for this repository. Tagged `D`.
- **OD-SM-2** Whether prompt-injection resistance for provider-sourced content needs a dedicated
  sanitization stage beyond structural validation. Tagged `X`.
- **OD-SM-3** Retention and access policy for `audit_logs` and `payment_events.payload`, which both
  carry sensitive data. Tagged `X` (shared with OD-DB-3).
- **OD-SM-4** Rate limiting on checkout and auth endpoints. The brief does not specify it; absence
  is a real exposure. Tagged `D`.
