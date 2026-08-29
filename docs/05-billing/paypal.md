# PayPal Integration

## Purpose

Specify PayPal Business as the sole customer payment provider: how a purchase is initiated, verified,
settled, reconciled, and reversed — with the client treated as an untrusted participant throughout.

## Scope

In scope: configuration, the checkout flow, webhook handling, idempotency, the ledger, subscription
lifecycle, and reconciliation. Out of scope: entitlement semantics ([entitlements](entitlements.md))
and package quotas ([business-rules §6](../00-product/business-rules.md#6-packages-quotas-entitlements)).

## Source of truth

- `S1` Strategic brief — PayPal as sole provider, USD, monthly subscription, the mandated flow, the
  list of values the browser may not supply, the provider-neutral ledger shape, replay protection,
  idempotent settlement, the `*/5 * * * *` reconciliation cron, and the prohibition on public test
  checkout endpoints.
- `S2`/`S3` Legacy `paypal-migration-strategy.md` and `payment-provider-strategy.md` — **not
  available**. Nothing here is inherited from them.
- `S4` PayPal developer documentation — **must be verified before implementation**. Every API name,
  endpoint, event type, and signature scheme below is a requirement to confirm, not a confirmed
  fact. OD-PP-1.
- `D` Design decisions proposed here.

## Requirements

### R-PP-1 Configuration `S1` + `D`

| Item | Location | Rule |
| --- | --- | --- |
| Client id (sandbox / live) | Supabase Vault | Read at call time; never inlined |
| Secret | Supabase Vault | Never logged, never in a URL, never in the bundle |
| Webhook id | Supabase Vault | Required for signature verification |
| Environment selector | Server environment variable | **Never** derived from a request parameter or header (BR-PM-14) |
| Access token | In-memory, per invocation | Cached only within a function lifetime; never persisted |

The environment selector being request-independent is what prevents a production request from being
routed to sandbox (or the reverse) by a crafted client.

**Both environments are USD.** The PayPal business account, the catalog products, and the plans are
all configured in USD. Every order, capture, subscription charge, refund, and dispute is a USD
transaction, and `payments.currency` is constrained to `USD` so a non-USD settlement is not
representable. No exchange rate is read from the provider and none is stored.

### R-PP-2 Checkout flow `S1`

```
Browser sends plan key only                    ("signal_pro")
  ↓
Edge Function resolves authoritative package    packages.key → price_cents, currency, provider_plan_id
  ↓
Edge Function creates PayPal order/subscription server-side
  ↓
Browser approves through PayPal JS SDK          (SDK loaded with the PUBLIC client id only)
  ↓
Webhook verification  AND  server-side read-back of the transaction
  ↓
Normalized payment ledger                       payments + payment_events
  ↓
Entitlement update                              organizations.package_id
  ↓
PAID_ONBOARDING
  ↓
ACTIVE                                          (after onboarding completes — OD-BR-6)
```

Both verification steps are mandatory. The brief requires "webhook/read-back verification"; treating
either as sufficient is the classic PayPal integration defect, because the browser's `onApprove`
callback fires on buyer intent, not on captured funds.

### R-PP-3 What the browser may not supply `S1`

The checkout request body carries a plan key and nothing else. Server-side rejection is required for
any of:

| Forbidden field | Why |
| --- | --- |
| `amount`, `price`, `total` | Price is server-owned (BR-PM-04, BR-PK-05) |
| `currency` | USD only (BR-PM-02). Rejected outright — not coerced, not converted. |
| `access_state`, `status`, `paid` | Access state is server-owned (BR-AC-02) |
| `role` | Roles are server-owned (BR-RB-02) |
| `organization_id` for a tenant the caller does not belong to | Tenant scope is derived, not supplied (BR-TI-05) |
| `secret`, `token`, `client_secret`, `access_token` | No secret travels from the client |

Handling: an unrecognized or forbidden key is a `400` and an audited event, not a silently ignored
field. Silent ignoring hides an attacker probing the contract.

### R-PP-4 Webhook verification and replay protection `S1` + `S4`

```
receive webhook
  ↓
verify signature against PayPal                (transmission id, transmission time, cert url,
                                                auth algo, raw body, signature, webhook id)
  ↓  fail → 400, no state change, audited
extract provider event id
  ↓
insert into payment_events (provider, provider_event_id, …)
  ↓  unique violation → already seen → 200, no-op        ← replay protection
record received_at; reject if occurred_at is outside the accepted window
  ↓
process by event type → settlement / lifecycle change
  ↓
mark processed_at
```

- The **unique constraint on `(provider, provider_event_id)`** is the replay defence. It is a
  database guarantee, so it holds even if two webhook deliveries race.
- The **raw body** is used for verification. Re-serializing the parsed JSON invalidates the
  signature; the handler must read bytes before parsing.
- The **timestamp window** limits replay of an old, validly-signed transmission. The window length is
  `D` and needs approval (OD-PP-3).
- Verification uses the configured `webhook_id`. A webhook id from the wrong environment verifies
  nothing and must fail closed.

### R-PP-5 Idempotent settlement `S1`

| Guarantee | Mechanism |
| --- | --- |
| One ledger row per provider transaction | `unique (provider, provider_transaction_id)` — INV-9 |
| One entitlement change per settlement | Settlement is a single transaction: insert ledger row, update `organizations`, write `audit_logs`. A retry finds the ledger row present and stops. |
| Safe under concurrent delivery | The unique constraint makes the second inserter lose, deterministically |
| Safe under webhook + read-back racing | Both paths converge on the same `internal_order_id`; the second is a no-op |

Settlement is expressed as *insert-then-act*, never *check-then-insert*. A check-then-insert
implementation has a race window that a duplicate delivery will eventually find.

### R-PP-6 Subscription lifecycle `S1` (requirement) / `X` (behaviour)

The brief mandates that renewal, cancellation, payment failure, refund, and dispute are all handled
and recorded. It does not define the resulting behaviour, and the legacy strategy documents are
unavailable. Therefore:

| Concern | Required | Behaviour |
| --- | --- | --- |
| Renewal success | Handled | `X` — OD-PP-4 |
| Renewal failure | Handled | `X` — grace period and dunning are BR-SB-05 |
| Cancellation by customer | Handled, recorded | `X` — end-of-period vs immediate is OD-PP-5 |
| Refund | Recorded as a record (BR-SB-03) | Effect on access state is `X` |
| Dispute | Recorded as a record | Effect on access state is `X` |
| Provider → internal state map | Required | `X` — BR-SB-04 |

This table is intentionally half-empty. Filling the right column without a source would mean
inventing payment lifecycle behaviour, which the brief forbids explicitly.

### R-PP-7 Reconciliation `S1`

- Cron: `payment-reconciliation` at `*/5 * * * *`.
- Purpose: converge internal state with provider truth when a webhook is missed, delayed, or
  rejected. It is the safety net, not the primary path.
- Inputs: `payments` rows in a non-terminal internal status older than a threshold, and
  `payment_events` rows with `processed_at is null`.
- Output: settlement, retry with backoff, or a `FAILED` row surfaced in the admin **Action Required**
  queue. Reconciliation must never silently drop a discrepancy.
- Reconciliation is idempotent by construction: it converges toward provider state, so running it
  twice is harmless.

### R-PP-8 Prohibited `S1`

| Prohibition | Rule |
| --- | --- |
| Mayar | No adapter, client, config, table column, or code path. Not present as a "future provider". |
| Midtrans | Not a v2 provider. |
| Stripe, in any path | PayPal is the sole customer checkout provider. |
| Public test/debug checkout endpoint | **Absolute, all environments.** A sandbox-only debug endpoint is still a public test payment endpoint. Sandbox testing uses the real flow against PayPal sandbox. |
| Client-side secret | The SDK receives the public client id only. |
| Global `transaction_id` | Column does not exist; provider-scoped uniqueness instead (INV-10). |

### R-PP-9 Live verification `D`

Live cutover is a controlled, documented event, not a flag flip:

1. Sandbox end-to-end passes, including a webhook replay test and a refund record test.
2. A single real transaction at the lowest plan, by a known internal buyer.
3. Verify: ledger row, entitlement, access state, audit entry, and the absence of any secret in logs.
4. Reverse it (refund) and verify the refund is recorded and access state reacts per the resolved
   OD-PP-4/5.
5. Only then enable live checkout for customers.

## Security considerations

- **The client is hostile.** R-PP-3 is a rejection list, not a suggestion. Every field on it has been
  the basis of a real-world payment bypass.
- **`onApprove` is not payment.** Treating the browser callback as confirmation grants entitlement
  for free. R-PP-2's dual verification exists for exactly this.
- **Secrets** live in Vault, are read per invocation, and never appear in a URL, a log, or the
  bundle. See [secrets](../07-security/secrets.md).
- **Webhook authenticity** is the only thing standing between the internet and the entitlement
  system. Signature verification, the raw-body requirement, and the timestamp window are all
  load-bearing.
- **Existence oracles.** A checkout attempt against another tenant's `organization_id` returns `404`,
  consistent with [R-AU-6](../03-auth/authentication-authorization.md#r-au-6-denial-contract-d).
- **Audit completeness.** Every state change here — settlement, suspension, refund, dispute, manual
  admin override — writes to `audit_logs` (BR-PM-12). An unaudited payment mutation is a defect
  regardless of correctness.
- **Amount integrity.** The amount charged is read from `packages` at order-creation time and is
  never accepted from, or reconciled against, the client. It is USD integer cents throughout.
- **No currency inference.** Currency is never derived from the buyer's country, the PayPal account's
  country, or the request locale. There is one value and it is `USD`
  ([currency-and-cost-policy R-CU-3](../00-product/currency-and-cost-policy.md#r-cu-3-currency-is-never-derived-from-context-s1)).
- **No Mayar, Midtrans, or Convex path exists**, in any environment, including as dead code
  ([legacy-exclusion-list](../00-product/legacy-exclusion-list.md)).

## Acceptance criteria

- [ ] A checkout request containing `amount`, `currency`, `role`, `status`, or a foreign
      `organization_id` is rejected with `400` and audited.
- [ ] The charged amount always equals `packages.price_cents` for the resolved key, for all three
      plans.
- [ ] An unverified webhook (bad signature) causes no state change and is audited.
- [ ] The same webhook delivered twice produces exactly one `payments` row and one entitlement change.
- [ ] The same webhook delivered twice concurrently produces exactly one of each.
- [ ] A webhook with `occurred_at` outside the accepted window is rejected.
- [ ] Entitlement is granted only after verification; simulating `onApprove` without a valid
      provider transaction grants nothing.
- [ ] Reconciliation resolves a deliberately dropped webhook within one cron cycle.
- [ ] A refund and a dispute each produce a record and an audit entry.
- [ ] `grep` finds no `mayar`, `midtrans`, or `stripe` reference outside prohibition documentation.
- [ ] No route matching a test/debug checkout pattern exists in any environment.
- [ ] No secret value appears in any log line produced during a full sandbox checkout.

## Related skills

- [`system-design`](../SKILLS.md#system-design) — idempotency and reconciliation.
- [`ddia-systems`](../SKILLS.md#ddia-systems) — exactly-once effects over at-least-once delivery.
- [`release-it`](../SKILLS.md#release-it) — R-PP-9 staged live cutover and rollback.
- [`supabase`](../SKILLS.md#supabase) — Vault and Edge Function invocation model.
- [`clean-architecture`](../SKILLS.md#clean-architecture) — the PayPal adapter sits behind an interface.

## Open decisions

- **OD-PP-1 (blocking Phase 7)** Verify every PayPal API surface against current provider
  documentation: Subscriptions vs Orders v2 for monthly billing, webhook signature verification
  parameters, and the exact event type names for renewal, cancellation, refund, and dispute. The
  brief does not name them and they must not be guessed.
- **OD-PP-2** PayPal plan ids per package, and whether plans are created via API or in the PayPal
  console. Tagged `X`.
- **OD-PP-3** Webhook timestamp window length. Tagged `D`.
- **OD-PP-4** Renewal-failure behaviour: grace period, dunning schedule, and the access state used
  during dunning. Tagged `X` (BR-SB-05).
- **OD-PP-5** Cancellation semantics: end-of-period versus immediate, and refund policy. Tagged `X`.
- **OD-PP-6** Whether refunds and disputes move access state to `SUSPENDED` or leave it to admin
  judgement. Tagged `X`.
