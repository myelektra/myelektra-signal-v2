# RLS Verification

## Purpose

Define the test matrix that proves RLS holds, per table, per role, in both directions — the check
behind the claim "no cross-tenant access".

## Scope

In scope: the matrix, the roles and fixtures it uses, the assertions, and what a pass means. Out of
scope: policy design ([rls](../02-database/rls.md)) and general test strategy
([test-strategy](test-strategy.md)).

## Source of truth

- `S1` Strategic brief — RLS verification and tenant-isolation tests as required quality-gate checks.
- `D` Matrix design proposed here. Harness choice is OD-TS-1.

## Requirements

### R-RV-1 It runs against real Postgres `D`

RLS semantics are the database's. Testing policies through a mock proves nothing about them. The
suite runs SQL against a real Postgres with the migrations applied, using JWTs that represent each
role.

### R-RV-2 Fixtures `D`

A minimum of two tenants and three identities:

| Fixture | Purpose |
| --- | --- |
| Tenant A with one `CUSTOMER` | The primary actor |
| Tenant B with one `CUSTOMER` | The other side — isolation is tested in both directions |
| One `ADMIN`, one `SUPER_ADMIN` | Privileged paths |
| One authenticated user with **no membership** | Proves absence of membership means absence of access |
| One `anon` request | Proves the public role sees nothing tenant-owned |

Every tenant-owned table is seeded with at least one row per tenant, so an empty result cannot be
mistaken for successful isolation. **This is the most common way an RLS test lies**: asserting zero
rows against a table that was never populated passes whether or not the policy works.

### R-RV-3 The matrix `S1` + `D`

For every tenant-owned table `T`, and for tenant A's `CUSTOMER` JWT:

| # | Operation | Assertion |
| --- | --- | --- |
| 1 | `select` own rows | Returns exactly A's rows |
| 2 | `select` all rows | Returns zero of B's rows |
| 3 | `select` with an explicit `where organization_id = <B>` | Returns zero rows |
| 4 | `insert` with `organization_id = <A>` | Succeeds where permitted by [R-RL-3](../02-database/rls.md#r-rl-3-policy-matrix-s1--d) |
| 5 | `insert` with `organization_id = <B>` | Rejected |
| 6 | `update` own row, permitted columns | Succeeds where permitted |
| 7 | `update` B's row | Affects zero rows |
| 8 | `update` own row, denied columns (`score`, `role`, `access_state`, `is_verified`, `quantity`) | Rejected |
| 9 | `delete` B's row | Affects zero rows |
| 10 | `delete` own row | Succeeds only where permitted |

Row 8 is the column-level gate and is the one most often forgotten: a policy that permits updating a
row does not imply every column may be written.

### R-RV-4 Both directions `S1`

The matrix runs for A→B **and** B→A. A test that checks one direction passes against a policy that is
accidentally asymmetric, which is a real failure mode when policies are written per table by hand.

### R-RV-5 Privileged roles `D`

| Role | Assertion |
| --- | --- |
| `CUSTOMER` | The matrix above |
| `ADMIN` | Permitted reads succeed; writes outside the permission matrix are rejected. **Depends on OD-RB-1.** |
| `SUPER_ADMIN` | Permitted operations succeed; `audit_logs` writes are still rejected |
| No membership | Zero rows on every tenant-owned table |
| `anon` | Zero rows on every tenant-owned table except the explicitly public catalog view |

The `SUPER_ADMIN` row asserting that `audit_logs` is still unwritable is deliberate: append-only means
append-only for everyone, including the most privileged role.

### R-RV-6 Structural assertions `D`

Beyond behaviour, assert the structure that produces it:

- Every tenant-owned table has `rowsecurity = true` in `pg_tables`.
- No tenant-owned table has a `FORCE`-less permissive fallback.
- Every `SECURITY DEFINER` function in `app` has an explicit `set search_path`.
- No grant to `public` or `anon` exists on a tenant-owned table, except the declared public view.
- Every tenant-owned table has `organization_id not null` with a declared FK.

These catch the failure mode the behavioural matrix cannot: a **newly added table** with no policies.
Behavioural tests written for existing tables pass; the structural assertion fails the build.

### R-RV-7 Coverage rule `D`

Adding a tenant-owned table without adding it to this suite fails CI. The list of tables under test is
derived from the schema, not maintained by hand, so it cannot drift.

## Security considerations

- **Seeded fixtures are what make the assertions meaningful** (R-RV-2). An unseeded table produces a
  vacuous pass.
- **Both directions** (R-RV-4) catches asymmetric policies.
- **Column-level denial is tested separately from row-level** (R-RV-3 row 8), because they are
  different mechanisms and one can be correct while the other is not.
- **Structural assertions cover the future**, which is where the risk actually lives: today's tables
  were reviewed, next month's table will be added by someone in a hurry.
- **The suite is a gate.** A red RLS test blocks merge, without exception.

## Acceptance criteria

- [ ] The matrix runs for every tenant-owned table, in both directions, and passes.
- [ ] Every table under test is seeded for both tenants before assertions run.
- [ ] Row 8 (column denial) is asserted for `signals.score`, `organization_members.role`,
      `organizations.access_state`, `signal_evidence.is_verified`, and `usage.quantity`.
- [ ] A no-membership JWT and an `anon` request see zero tenant rows.
- [ ] All structural assertions in R-RV-6 pass.
- [ ] The table list is derived from the schema; adding a table without coverage fails CI.
- [ ] The suite runs in CI on every pull request, or its absence is recorded as an `unavailable`
      gate with the exact blocker.

## Related skills

- [`supabase`](../SKILLS.md#supabase) — RLS semantics under test.
- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) —
  `SECURITY DEFINER` hygiene.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — automate the coverage rule.

## Open decisions

- **OD-TS-1** pgTAP versus `bun test`-driven SQL.
- **OD-TS-2** Whether CI provisions a full local Supabase stack, which determines whether this suite
  runs per PR or only pre-merge.
- **OD-RB-1** `ADMIN` scope — the `ADMIN` rows of R-RV-5 cannot be finalized without it.
