# Authentication and Authorization

## Purpose

Define how a request becomes an authorized action: how identity is established, how membership and
role are resolved, how access state gates data, and why none of this may be delegated to the
frontend.

## Scope

In scope: identity, session handling, the authorization resolution sequence, roles, access states,
and the enforcement points. Out of scope: RLS policy text ([rls](../02-database/rls.md)) and payment
state transitions ([paypal](../05-billing/paypal.md)).

## Source of truth

- `S1` Strategic brief — Supabase Auth as the identity provider, the three roles, the five access
  states, the four-step resolution flow, and the rule that route hiding is not authorization.
- `S4` Supabase Auth documentation — session model, JWT claims, refresh behaviour. Must be verified.
- `D` Design decisions proposed here.

## Requirements

### R-AU-1 Identity `S1`

- Supabase Auth is the sole identity provider for customers and admins.
- No custom password store, no bespoke session table, no second auth system. `@convex-dev/auth` and
  any equivalent are prohibited.
- `auth.users.id` is the only durable user identity. Application tables reference it by FK; they
  never duplicate email as a key.

### R-AU-2 Roles `S1`

| Role | Meaning | Scope |
| --- | --- | --- |
| `CUSTOMER` | A member of an organization who uses Signals | One or more organizations |
| `ADMIN` | Operational access to the control plane | **`X` — see OD-RB-1** |
| `SUPER_ADMIN` | Full platform authority, including role grants and package changes | Platform |

- Roles are stored on `organization_members`, never in the JWT as an unverified claim and never in
  client storage.
- Role changes are `SUPER_ADMIN`-only, server-side, and audited (BR-RB-02, BR-RB-04).
- A user with no membership row has no role and no access, regardless of a valid session.

### R-AU-3 Access states `S1`

```
PENDING_PAYMENT → PAYMENT_PROCESSING → PAID_ONBOARDING → ACTIVE
                                                          ↘ SUSPENDED
```

| State | Meaning | Data access |
| --- | --- | --- |
| `PENDING_PAYMENT` | Organization exists, no settled payment | None beyond checkout and settings |
| `PAYMENT_PROCESSING` | PayPal interaction in flight, not yet verified | None beyond checkout status |
| `PAID_ONBOARDING` | Payment settled, onboarding incomplete | Onboarding surfaces only |
| `ACTIVE` | Paying and onboarded | Full entitlement per package |
| `SUSPENDED` | Access withdrawn | **`X` — BR-AC-09** |

- Access state is owned by the server and stored on `organizations` (BR-AC-03).
- Only settlement (BR-PM-10) and admin action may advance it. No client request may.

### R-AU-4 Resolution sequence `S1`

Every request that touches tenant data executes this sequence. Skipping a step is a defect.

```
1. Authenticate          verify the Supabase JWT; reject if absent, expired, or malformed
2. Resolve membership    organization_members → (organization_id, role); reject if none
3. Resolve access state  organizations.access_state; deny data access unless ACTIVE
                         (or the narrow surfaces permitted in earlier states)
4. Resolve onboarding    organizations.onboarding_state; gate PAID_ONBOARDING surfaces
5. Allow or deny         return data, or a typed denial the UI can render
```

Steps 2–4 are evaluated server-side on every request. They are not evaluated once at login and
cached in the client, because that would make suspension and role revocation non-immediate.

### R-AU-5 Enforcement points `S1`

| Layer | Enforces | Cannot enforce |
| --- | --- | --- |
| SPA routing | Which screen to render | Nothing. It is presentation. |
| Edge Function | Whether the *action* is permitted | Row-level visibility for direct client DB reads |
| RLS | Which *rows* a JWT can see | Whether an action is permitted |

The three layers are complementary. The rule to remember: **a route that is hidden is still
reachable**, and an endpoint that does not authorize is exploitable by anyone who can read the
bundle. Authorization is therefore implemented in Edge Functions and RLS, and the SPA's route
guards exist purely to avoid rendering a screen that will fail.

### R-AU-6 Denial contract `D`

Denials are typed so the UI can render the right state instead of a generic error:

| Condition | Response | SPA behaviour |
| --- | --- | --- |
| No/invalid JWT | `401 unauthenticated` | Redirect to sign-in |
| Valid JWT, no membership | `403 no_membership` | Show "no organization" state, not a blank screen |
| Member, `PENDING_PAYMENT` | `403 payment_required` | Route to checkout |
| Member, `PAID_ONBOARDING` | `403 onboarding_required` | Route to onboarding |
| Member, `SUSPENDED` | `403 suspended` | Show suspension notice |
| Member, insufficient role | `403 insufficient_role` | Hide action, show explanation |
| Cross-tenant attempt | `404` | Indistinguishable from nonexistent — no existence oracle |
| Client-supplied `currency` in a checkout request | `400 invalid_request` | Currency is USD by constraint and is never accepted from a client |

A cross-tenant attempt returns `404`, not `403`. Returning `403` confirms the resource exists and
hands an attacker a tenant-enumeration oracle.

### R-AU-7 Session and token handling `D`

- Tokens live in Supabase Auth's managed storage. They are never written to `localStorage` by
  application code, never placed in a URL, never logged.
- The raw `Authorization` header is never logged (a security requirement from the brief). Request
  logging redacts it structurally, not by string matching.
- No secret or token appears in any URL query string (BR-PM-03 and the security checklist).

### R-AU-8 Sign-in methods `X`

Which Supabase Auth providers are enabled — email/password, magic link, OAuth — is **not specified**
in the brief and is not recoverable without the legacy repository. This document does not choose.
OD-AU-1.

## Security considerations

- **The frontend is not a control.** Everything in R-AU-5 exists because the brief states route
  hiding is not authorization. Any review that accepts "the button is hidden" as a mitigation must be
  rejected.
- **No cached authority.** Re-evaluating membership and access state per request is what makes
  suspension effective. A client-cached role is a suspension that does not take effect until the
  token expires.
- **`404` over `403`** for cross-tenant access (R-AU-6) closes the enumeration oracle.
- **Admin paths are the highest-value target.** Admin authorization is checked in the Edge Function
  on every request, not once per session.
- **Currency is not a client input.** A request cannot set or influence the currency of a price,
  payment, or subscription. Currency is USD by `check` constraint, and a request containing a
  `currency` field is rejected and audited
  ([currency-and-cost-policy R-CU-3](../00-product/currency-and-cost-policy.md#r-cu-3-currency-is-never-derived-from-context-s1)).
- **Privileged mutations are audited** (BR-RB-04), including failed authorization attempts for admin
  actions — a repeated `insufficient_role` on an admin endpoint is an attack signal, not noise.
- **The first `SUPER_ADMIN`** must be provisioned out-of-band (OD-RB-3). An endpoint that grants
  `SUPER_ADMIN` is a bootstrapping vulnerability; a migration or a manual SQL step is not.

## Acceptance criteria

- [ ] A request with no JWT receives `401` and no data.
- [ ] A valid JWT with no membership row receives `403 no_membership` and no data.
- [ ] A `PENDING_PAYMENT` member cannot read `signals`; a `PAID_ONBOARDING` member cannot read
      production Signals until onboarding completes.
- [ ] A `CUSTOMER` JWT attempting to read another organization's rows receives `404` and the attempt
      is audited.
- [ ] Suspending an organization takes effect on the next request, with no token refresh required.
- [ ] No client-side route guard is the sole control for any screen; verified by test, per
      [test-strategy](../10-testing/test-strategy.md).
- [ ] No raw `Authorization` header appears in any log output — verified by a log-redaction test.

## Related skills

- [`supabase`](../SKILLS.md#supabase) — Auth and JWT claim semantics.
- [`clean-architecture`](../SKILLS.md#clean-architecture) — authorization as a boundary concern.
- [`release-it`](../SKILLS.md#release-it) — typed denials and observable failure.

## Open decisions

- **OD-AU-1** Which sign-in methods are enabled (email/password, magic link, OAuth). Tagged `X`.
- **OD-RB-1** Is `ADMIN` platform-scoped or organization-scoped? Blocks both this document and
  [rls](../02-database/rls.md#r-rl-3-policy-matrix-s1--d). Tagged `X`.
- **OD-RB-2** The per-action permission matrix separating `ADMIN` from `SUPER_ADMIN`. Tagged `X`.
- **OD-RB-3** How the first `SUPER_ADMIN` is provisioned. Tagged `X`.
- **OD-AU-2** Whether `SUSPENDED` permits read-only historical access. Tagged `X` (BR-AC-09).
- **OD-BR-6** Onboarding completion criteria — what moves `PAID_ONBOARDING → ACTIVE`. Registered in [open-decisions](../00-product/open-decisions.md). Tagged `X` (BR-AC-06).
  (BR-AC-06).
