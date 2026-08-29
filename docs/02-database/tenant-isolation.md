# Tenant Isolation

## Purpose

State tenant isolation as a database invariant, enumerate the ways it can be violated, and define
the verification that proves it holds in both directions.

## Scope

In scope: the invariant, the violation vectors, and the enforcement stack. Out of scope: policy text
([rls](rls.md)) and table shapes ([schema](schema.md)).

## Source of truth

- `S1` Strategic brief — tenant isolation as a database invariant, BR-TI-01…07, and the prohibitions
  on client-controlled scope and cross-tenant access.
- `D` Design decisions proposed here.

## Requirements

### R-TI-1 The invariant `S1`

> An organization can neither read nor write another organization's rows, through any path, for any
> reason.

This is an invariant, not a goal. A violation is a defect of the same severity as a leaked credential,
and is treated as such in review and in incident response.

### R-TI-2 Enforcement stack `S1` + `D`

| Layer | Mechanism | Stops |
| --- | --- | --- |
| Schema | `organization_id not null` + FK on every tenant-owned row | Orphaned or unscoped data |
| RLS | Deny-by-default policies keyed on JWT-derived membership | Direct client reads and writes — **row-level only** |
| Column `REVOKE` | Denial on `role`, `access_state`, `score`, `currency`, `amount_usd`, `is_verified` | Escalation through a permitted row |
| `BEFORE UPDATE` trigger | Changing an immutable field, even by a privileged role | Accidental or future-policy-mistake writes |
| `CHECK` constraint | Representing an invalid value — non-USD currency, negative amount, out-of-range score | Data that no code path intended |
| Edge Function | Explicit authorization; scope derived from JWT | Action-level abuse of the service role |
| Uniqueness | Composite keys including `organization_id` | Cross-tenant interference via deduplication |
| Response code | `404` for cross-tenant attempts | Existence enumeration |

No layer is sufficient alone. RLS is void inside a service-role function; function authorization does
not constrain a direct client database read; and **RLS cannot protect a column**, so a field that must
not change needs a `REVOKE` and a trigger. The stack is the control.

### R-TI-3 Scope derivation `S1`

Tenant scope is **derived**, never accepted:

```
JWT → auth.users.id → organization_members → organization_id(s)
```

A request may supply an `organization_id`; it is validated against the caller's memberships and a
mismatch returns `404` (not `403`, which would confirm existence). Where the server can derive the
value, it does not read the request at all — derivation is strictly stronger than validation.

### R-TI-4 Violation vectors `D`

Each of these has been a real cross-tenant bug somewhere. Each has a corresponding test.

| Vector | Defence |
| --- | --- |
| Client sends another tenant's `organization_id` | Derivation + validation + `404` |
| A policy compares against a request parameter instead of the JWT | Policies use `app.current_org_ids()` only |
| A function trusts a body-supplied tenant | R-BE-3 explicit authorization |
| A query joins across organizations (e.g. global deduplication) | Tenant-scoped uniqueness ([deduplication R-DD-2](../04-signals/deduplication.md#r-dd-2-scope-is-the-tenant-d)) |
| A `SECURITY DEFINER` function with an unpinned `search_path` is shadowed | `set search_path` on every such function |
| A permissive fallback policy makes unlisted tables readable | No permissive fallback exists |
| A `GRANT` to `public` or `anon` on a tenant table | Grant assertions in the RLS verification suite |
| An admin function filters by role but not by scope | Admin authorization is scope-aware (depends on OD-RB-1) |
| A background job writes with a tenant id read from untrusted input | Jobs carry `organization_id` from the dispatch that created them |
| An error message leaks another tenant's data | Errors are typed codes; no payload echo |

### R-TI-5 Verification in both directions `S1`

Isolation is tested from both sides: tenant A must not reach B's data, **and** B must not reach A's.
A test that only checks one direction passes against a policy that is accidentally asymmetric.

See [rls-verification](../10-testing/rls-verification.md) for the matrix.

### R-TI-6 Non-obvious shared surfaces `D`

| Surface | Risk | Rule |
| --- | --- | --- |
| Deduplication index | Leaks that another tenant monitors company X | Tenant-scoped, always |
| `packages` | Genuinely shared, and should be | Read-only, no tenant columns |
| `audit_logs` | Contains cross-tenant detail | Not customer-readable at all |
| `signal_jobs.last_error` | May quote provider text | Admin-readable only |
| Aggregates in admin **Economics** | Could expose a single tenant's activity | Aggregate only, with a minimum-cohort rule |
| Error messages and logs | The classic accidental leak | Typed codes; no payload echo |

The economics aggregate deserves attention: a platform-wide revenue chart with three customers can
deanonymize a tenant by elimination. Minimum-cohort suppression is cheap and prevents it.

## Security considerations

- **Deny-by-default is the decision that makes a forgotten policy survivable.** With a permissive
  fallback, the forgotten policy is a breach; without one, it is a bug report.
- **`404` over `403`** removes the enumeration oracle. Returning `403` for a resource that exists and
  `404` for one that does not turns every endpoint into a tenant-existence checker.
- **The service role voids RLS.** Every function is a potential isolation bypass, which is why R-BE-3
  is mandatory and why functions are split by purpose.
- **Isolation must be tested continuously**, not once. A new table added without policies is
  invisible until a customer's data appears in someone else's dashboard.
- **Aggregation is a leak channel.** Anonymity in a small cohort is not anonymity.

## Acceptance criteria

- [ ] Every tenant-owned table has `organization_id not null` with a declared FK.
- [ ] No policy references a request parameter for scope.
- [ ] Cross-tenant read and write attempts are denied in both directions, per table, by test.
- [ ] A cross-tenant attempt returns `404` and is audited.
- [ ] No query joins `signals`, `payments`, or any tenant table across organizations.
- [ ] Every `SECURITY DEFINER` function pins `search_path`.
- [ ] Each protected column is guarded by the mechanism that can actually guard it — `REVOKE` and/or
      trigger — and not by an RLS policy alone.
- [ ] No permissive fallback policy exists on any tenant-owned table.
- [ ] Admin aggregates suppress cohorts below the minimum size.

## Related skills

- [`system-design`](../SKILLS.md#system-design) — defence in depth.
- [`supabase`](../SKILLS.md#supabase) — RLS semantics and the service role.
- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) —
  `SECURITY DEFINER` hygiene.
- [`ddia-systems`](../SKILLS.md#ddia-systems) — invariants that hold under concurrency.

## Open decisions

- **OD-RB-1** Is `ADMIN` platform-scoped or organization-scoped? Determines whether admin reads are
  cross-tenant by design. **Blocks the admin policy text.**
- **OD-TI-1** Minimum cohort size for admin aggregates.
- **OD-TI-2** Whether a user may belong to multiple organizations. The schema permits it; the product
  may not intend it. Affects the resolution flow in R-AU-4.
