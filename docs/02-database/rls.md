# Row Level Security

## Purpose

Specify the RLS layer that makes tenant isolation a database invariant rather than an application
convention, and define the verification that proves it holds.

## Scope

In scope: role model in the database, helper functions, per-table policy intent, and the
deny-by-default posture. Out of scope: table shapes ([schema](schema.md)) and the HTTP-level
authorization flow ([authentication-authorization](../03-auth/authentication-authorization.md)).

## Source of truth

- `S1` Strategic brief — the invariants (BR-TI-01…07, INV-1…10) and the five prohibitions on what a
  customer may change.
- `S4` Supabase documentation for `auth.jwt()`, `auth.role()`, and `SECURITY DEFINER` semantics —
  must be verified against current Supabase behaviour before implementation.
- `D` Policy design proposed here.

## Requirements

### R-RL-1 Posture `S1`

1. **Deny by default.** `ENABLE ROW LEVEL SECURITY` on every tenant-owned table, and **no** table
   carries a permissive fallback. If no policy matches, the row is invisible. This is the difference
   between "we wrote policies for the paths we thought of" and "unlisted paths are closed".
2. **`FORCE ROW LEVEL SECURITY`** on tables where the table owner should not bypass either, so that
   a migration run as owner cannot silently read across tenants.
3. **Two enforcement points.** RLS governs *data access*. Edge Functions govern *actions*. A
   function that performs a privileged action must authorize explicitly; it cannot rely on RLS to
   have done it, because it runs with a service-scoped role that bypasses RLS by design.

### R-RL-2 Identity helpers `D`

Policies must not parse the JWT inline. Three `SECURITY DEFINER` helpers are the only sanctioned way
to ask "who is this" inside a policy:

```sql
create schema app;

-- current authenticated user id
create or replace function app.current_user_id() returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

-- organizations this user belongs to
create or replace function app.current_org_ids() returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select organization_id from organization_members
      where user_id = app.current_user_id() $$;

-- does the current user hold one of the given roles in org?
create or replace function app.has_role(p_org uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (
        select 1 from organization_members
        where organization_id = p_org
          and user_id = app.current_user_id()
          and role = any (p_roles)
      ) $$;
```

Non-negotiable details:

- `set search_path = public, pg_temp` on every one. A `SECURITY DEFINER` function without a pinned
  `search_path` is a privilege-escalation vulnerability: a tenant who can create an object in a
  schema earlier on the search path shadows the referenced table.
- `stable`, not `volatile`: these are evaluated per statement, and stability lets Postgres cache.
- Grants: `execute` to `authenticated` only. Never to `anon`.

### R-RL-3 Policy matrix `S1` + `D`

`Y` = permitted, `—` = denied by absence of a policy.

| Table | CUSTOMER read | CUSTOMER insert | CUSTOMER update | CUSTOMER delete | ADMIN | SUPER_ADMIN |
| --- | --- | --- | --- | --- | --- | --- |
| `organizations` | own | — | name only | — | read all | write |
| `organization_members` | own org | — | — | — | read own org | write |
| `monitoring_profiles` | own org | own org | own org | own org | read all | write |
| `monitored_accounts` | own org | own org | own org | own org | read all | write |
| `existing_buyers` | own org | own org | own org | own org | read all | write |
| `signals` | own org | — | — | — | read all | — |
| `signal_evidence` | own org | — | — | — | read all | verify |
| `opportunities` | own org | own org | own org | own org | read all | write |
| `contacts` | own org | own org | own org | own org | read all | write |
| `notifications` | own org | — | own (read-state) | — | read all | write |
| `usage` | own org | — | — | — | read all | — |
| `subscriptions` | own org | — | — | — | read all | — |
| `payments` | own org | — | — | — | read all | — |
| `packages` | active | — | — | — | read | write |
| `delivery_config` | own org | own org | own org | own org | read all | write |
| `delivery_attempts` | own org | — | — | — | read all | — |
| `research_runs` / `signal_jobs` | — | — | — | — | read all | write |
| `audit_logs` | — | — | — | — | read | read |
| `payment_events` | — | — | — | — | read | write |
| `cost_entries` | — | — | — | — | read | insert |

The `—` cells in the CUSTOMER columns for `signals`, `signal_evidence`, `payments`, `subscriptions`,
`usage`, and `organization_members` are the mechanical expression of BR-SC-12, BR-EV-03, BR-AC-02,
and BR-RB-02. They are enforced by *not writing a policy*, which is the safest form of denial.

### R-RL-4 Restricted columns `S1`

Absence of an `UPDATE` policy on a table is coarse. Where a customer legitimately updates a row but
must not touch specific columns, column-level `GRANT` is used as a second gate:

| Table | Column denied to `authenticated` | Rule |
| --- | --- | --- |
| `organizations` | `access_state`, `onboarding_state`, `package_id` | BR-AC-02 |
| `organization_members` | `role` | BR-RB-02 |
| `signals` | `score`, `score_band`, `score_components`, `published_at` | BR-SC-12, BR-SG-05 |
| `signal_evidence` | `is_verified`, `verified_by`, `verified_at` | BR-EV-03 |
| `payments`, `subscriptions` | all | BR-AC-02 |
| `usage` | `quantity` | BR-PK-07 — a client must not be able to reset its own counter |
| `cost_entries` | all (`UPDATE`/`DELETE` revoked entirely) | BR-PM-17 — an editable cost history is an editable profit statement |
| `packages`, `payments`, `cost_entries` | `currency` | BR-PM-02 — currency is USD by `check` constraint and is not writable by anyone; a client-supplied `currency` is rejected at the Edge Function |
| `audit_logs` | all (`UPDATE`/`DELETE` revoked entirely) | BR-RB-05 |

Implementation: `revoke update on table … from authenticated`, then `grant update (col_a, col_b)`
for exactly the columns the customer owns. This inverts the default from "everything except the
dangerous ones" to "nothing except the safe ones".

### R-RL-5 Service role `S1`

Edge Functions use the service role, which bypasses RLS. That is a capability, not an authorization.
Rules:

- A service-role function must resolve the calling identity from the request JWT and re-check
  authorization explicitly before any read or write.
- It must never accept `organization_id` from the request body as the tenant scope. It derives scope
  from the JWT and validates any supplied id against it (BR-TI-05).
- Service-role credentials exist only inside Edge Functions. Their presence anywhere else is a
  security defect (see [security-model](../07-security/security-model.md)).

### R-RL-6 `anon` role `D`

The `anon` role has no grants on any tenant-owned table. The only unauthenticated reads in the
product are the public homepage's static plan catalog, which is served from the bundle or a
`packages` view explicitly granted to `anon` with `is_active = true` and no other columns exposed.

## Security considerations

- **Pinned `search_path`** on every `SECURITY DEFINER` function (R-RL-2) is the single most common
  way a Supabase RLS deployment becomes exploitable. It is called out because it is easy to omit and
  invisible in testing.
- **No permissive fallback** (R-RL-1) means a forgotten policy is a broken feature, not a data leak.
  This is the intended trade: fail closed, discover it in test.
- **Client-supplied scope** is the highest-value attack here. Every policy uses `app.current_org_ids()`
  or `app.has_role()`, both derived from the JWT. A policy that reads `organization_id` from a
  request parameter is a cross-tenant read.
- **Admin breadth.** `ADMIN` reading all organizations is only correct if `ADMIN` is platform-scoped.
  If it is org-scoped (OD-RB-1), the "read all" cells above are wrong. This is flagged rather than
  assumed.
- Policies are evaluated with the *current* membership. Revoking a membership must take effect
  immediately; there is no cached-authorization window.

## Acceptance criteria

- [ ] `select count(*) from pg_tables where schemaname='public' and not rowsecurity` returns 0
      for tenant-owned tables.
- [ ] Every `SECURITY DEFINER` function in `app` has an explicit `set search_path`.
- [ ] The `anon` role cannot select from any tenant-owned table.
- [ ] A `CUSTOMER` JWT from tenant A cannot select, insert, update, or delete any row of tenant B —
      verified per table by [rls-verification](../10-testing/rls-verification.md).
- [ ] A `CUSTOMER` cannot update `signals.score`, `organization_members.role`,
      `organizations.access_state`, or `signal_evidence.is_verified`, even for their own rows.
- [ ] `grant`/`revoke` state is asserted by a test, not only by inspection.

## Related skills

- [`supabase`](../SKILLS.md#supabase) — RLS and `auth.jwt()` semantics.
- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) —
  `SECURITY DEFINER` and `search_path`.
- [`system-design`](../SKILLS.md#system-design) — defence in depth.

## Open decisions

- **OD-RL-1** Is `ADMIN` platform-scoped or organization-scoped? Determines whether the "read all"
  column in R-RL-3 is correct. Blocks the admin policy text. Tagged `X`.
- **OD-RL-2** Should `payments` rows be visible to `ADMIN` with full metadata, or is a redacted view
  required? Tagged `D`.
- **OD-RL-3** Whether the public plan catalog is served from the bundle (simplest, requires a deploy
  to change price) or from an `anon`-granted view (no deploy, but a new attack surface). Tagged `D`.
