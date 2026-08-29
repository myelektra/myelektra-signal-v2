# Threat Model

## Purpose

Enumerate the threats this system actually faces, the control that answers each, and the residual
risk that remains. A control not tied to a threat is theatre; a threat without a control is a known
hole.

## Scope

In scope: threats arising from this architecture and product. Out of scope: generic web-application
threats with no specific manifestation here, and the control specifications themselves
([security-model](security-model.md)).

## Source of truth

- `S1` Strategic brief — the prohibitions and security requirements, which imply the threat set.
- `D` Threat enumeration proposed here. Residual-risk ratings are judgement and should be reviewed.

## Requirements

### R-TM-1 Assets

| Asset | Value |
| --- | --- |
| Service-role key | Total compromise — bypasses RLS across every tenant |
| Provider secrets (PayPal, OpenAI, search) | Financial and account compromise |
| Tenant Signal data | The product's entire value; a competitor-intelligence asset |
| Payment ledger | Financial correctness and dispute evidence |
| Monitoring profiles | Reveals who a customer is watching — commercially sensitive |
| Audit logs | Incident evidence |

### R-TM-2 Threats and controls

| ID | Threat | Actor | Control | Residual |
| --- | --- | --- | --- | --- |
| T-01 | Cross-tenant read via a client-supplied `organization_id` | Customer | Scope derivation + RLS + `404` ([R-TI-3](../02-database/tenant-isolation.md#r-ti-3-scope-derivation-s1)) | Low |
| T-02 | Cross-tenant write via a permissive policy | Customer | Deny-by-default, no fallback ([R-RL-1](../02-database/rls.md#r-rl-1-posture-s1)) | Low |
| T-03 | Privilege escalation by editing `role` | Customer | Column `GRANT` denial ([R-RL-4](../02-database/rls.md#r-rl-4-restricted-columns-s1)) | Low |
| T-04 | Self-granting access by editing `access_state` | Customer | Column `GRANT` denial; server-owned transitions | Low |
| T-05 | Inflating a Signal score | Customer | No `UPDATE` on `score*`; immutability (BR-SC-12) | Low |
| T-06 | Self-verifying evidence to publish a Signal | Customer | No `UPDATE` on `is_verified`; DB publication gate | Low |
| T-07 | **Payment bypass via a client-supplied amount** | Anonymous | Server-side price resolution; forbidden-field rejection ([R-PP-3](../05-billing/paypal.md#r-pp-3-what-the-browser-may-not-supply-s1)) | Low |
| T-08 | **Entitlement granted on `onApprove` without settlement** | Anonymous | Dual verification: webhook + read-back ([R-PP-2](../05-billing/paypal.md#r-pp-2-checkout-flow-s1)) | Low |
| T-09 | **Webhook replay to grant free service** | Anonymous | `unique (provider, provider_event_id)` + timestamp window ([R-ID-4](../06-jobs/idempotency.md#r-id-4-payment-keys-s1)) | Low |
| T-10 | Forged webhook (no valid signature) | Anonymous | Signature verification before any state change | Low |
| T-11 | **Service-role key leaked into the bundle** | Anonymous | Bundle scan + import-boundary lint | Low, but impact is total |
| T-12 | Public test/debug checkout endpoint abused | Anonymous | No such route in any environment | Low |
| T-13 | SSRF via a candidate `source_url` fetched by the pipeline | Anonymous (via scraped content) | Scheme allowlist + internal/loopback/link-local rejection | Medium — depends on the fetch allowlist (OD-VA-1) |
| T-14 | Stored XSS via evidence text or source name | Anonymous (via scraped content) | Render as text; validate URL scheme before linking | Low |
| T-15 | Prompt injection steering extraction toward a chosen Signal | Anonymous (via scraped content) | Structural validation, evidence gate, deterministic scoring | **Medium — genuinely hard; see below** |
| T-16 | Cost amplification by triggering unbounded runs | Authenticated | Bounded batches, bounded token budgets, cron-only dispatch | Low |
| T-17 | Tenant enumeration via `403` vs `404` | Anonymous | `404` for cross-tenant attempts | Low |
| T-18 | Monitoring-scope leak via global deduplication | Customer | Tenant-scoped deduplication ([R-DD-2](../04-signals/deduplication.md#r-dd-2-scope-is-the-tenant-d)) | Low |
| T-19 | Tenant deanonymization via admin aggregates | Admin | Minimum-cohort suppression (OD-TI-1) | **Unresolved until OD-TI-1** |
| T-20 | Audit-log tampering to hide a privileged action | Admin | Append-only; `UPDATE`/`DELETE` revoked; trigger raises | Low |
| T-21 | Credential leak via logs (auth header, token in URL) | Insider / anyone with log access | Structural redaction; no secrets in URLs | Low |
| T-22 | Suspended customer retains access via a cached token | Customer | Per-request re-resolution of membership and access state ([R-AU-4](../03-auth/authentication-authorization.md#r-au-4-resolution-sequence-s1)) | Low |
| T-23 | Reconciliation auto-reverses access during a provider outage | Provider fault | Escalate instead of auto-reverse ([R-RC-3](../05-billing/reconciliation.md#r-rc-3-actions-d)) | Low |
| T-24 | `SECURITY DEFINER` shadowing via an unpinned `search_path` | Customer (if schema create is granted) | Pinned `search_path` on every such function | Low |
| T-25 | Rate-limit-free brute force on auth or checkout | Anonymous | **Not implemented — OD-SM-4** | **High until resolved** |

### R-TM-3 Threats that deserve prose

**T-15, prompt injection.** The pipeline reads open-web content and asks a model to extract
commercial signals from it. A page can therefore contain instructions aimed at the model. Structural
validation and the evidence gate limit the outcome — an injected extraction still needs verified
evidence and must pass schema validation — but the residual risk is real and should not be described
as solved. Mitigations worth considering: treat scraped text as data with an explicit delimiter,
never as instruction; require that every extracted claim maps to a fetched source; and alert on
extraction patterns that deviate from the norm.

**T-25, missing rate limiting.** The brief does not mention rate limiting, and this documentation set
does not invent a policy for it. But its absence is a real exposure on both the auth endpoint
(credential stuffing) and the checkout endpoint (order-creation abuse, which costs money at the
provider). It is listed as `OD-SM-4` with a `High` residual rather than quietly omitted.

**T-19, aggregate deanonymization.** With a small customer base, a platform-wide economics chart can
identify a tenant by elimination. Minimum-cohort suppression is cheap. It is unresolved only because
the cohort size is a product decision.

### R-TM-4 Out of scope, stated explicitly

| Not modelled | Why |
| --- | --- |
| Supabase platform compromise | Provider responsibility; nothing here mitigates it |
| Vercel platform compromise | Same |
| PayPal platform compromise | Same |
| Physical/hosting attacks | Provider responsibility |
| Model provider training on submitted data | A provider agreement question, not an architectural control |

Stating these prevents the false comfort of a threat model that appears comprehensive.

## Security considerations

- **T-11 has the highest impact-to-likelihood ratio** in the system. The service role bypasses every
  RLS control in this documentation set, so the bundle scan and import-boundary lint are not
  redundant checks — they are the only thing preventing total compromise.
- **T-07 through T-10 form one attack family**: getting entitlement without paying. They are
  controlled by four independent mechanisms, which is deliberate.
- **T-25 is the only `High` residual.** It should be resolved before launch, not after.
- **Residual ratings are judgement**, made without the legacy repository's incident history. They
  should be revisited once that history is available.

## Acceptance criteria

- [ ] Every threat in R-TM-2 has a named control, and every control is verified by a test in
      [test-strategy](../10-testing/test-strategy.md).
- [ ] Every `High` or `Medium` residual has an owner and a resolution decision.
- [ ] T-25 (rate limiting) is resolved or explicitly accepted in writing before launch.
- [ ] T-19 (aggregate suppression) has a cohort size decided.
- [ ] This model is re-reviewed when the legacy repository's security history becomes available.

## Related skills

- [`system-design`](../SKILLS.md#system-design) — trust boundaries and defence in depth.
- [`release-it`](../SKILLS.md#release-it) — residual risk as operational risk.
- [`supabase`](../SKILLS.md#supabase) — what the platform controls versus what we do.

## Open decisions

- **OD-SM-4** Rate limiting. **`High` residual.**
- **OD-TI-1** Minimum cohort size for admin aggregates.
- **OD-SM-2** Prompt-injection hardening beyond structural validation.
- **OD-VA-1** The URL allowlist that bounds T-13.
