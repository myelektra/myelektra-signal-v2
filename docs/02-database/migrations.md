# Migrations

## Purpose

Define how schema changes are authored, sequenced, applied, and reversed — under the operating rule
that no migration is written before the schema decision is documented.

## Scope

In scope: authoring rules, sequencing, expand-then-contract, and rollback. Out of scope: the schema
itself ([schema](schema.md)) and policies ([rls](rls.md)).

## Source of truth

- `S1` Strategic brief — "do not create database migrations before documenting the schema decision",
  no legacy migration compatibility layer, no legacy production data to preserve.
- `S4` Supabase migration tooling documentation — must be verified.
- `D` Design decisions proposed here.

## Requirements

### R-MG-1 Documentation precedes migration `S1`

A migration may only be authored after the change is described in [schema](schema.md) and, where it
introduces or alters a rule, in [business-rules](../00-product/business-rules.md). The review
question is not "does this SQL run?" but "is this the schema we decided on?"

This rule exists because a migration is the hardest thing in the system to undo.

### R-MG-2 No legacy baseline `S1`

v2 migrations start from an empty database. There is no legacy schema to diff against, no data to
preserve, and no compatibility layer. The brief states plainly that no Mayar customers require
migration and no production payment data must be preserved — which is what makes a clean start
possible rather than merely preferable.

### R-MG-3 Forward-only, expand-then-contract `D`

Migrations move forward. Reversal is a new forward migration, never an automatic down-migration
applied under pressure. Therefore:

| Phase | Action | Deployable state |
| --- | --- | --- |
| Expand | Add the new column/table, nullable or defaulted | Old code still works |
| Migrate | Backfill; deploy code that writes both, reads new | Both paths work |
| Contract | Drop the old column in a later release | Old code is already gone |

A release that drops a column in the same deploy as the code that stops using it makes rollback
impossible, which converts a bad release into an incident with no exit.

### R-MG-4 Content rules `D`

- One concern per migration. A migration that adds a table and changes a policy and renames a column
  cannot be reviewed or reverted cleanly.
- Idempotent where practical (`if not exists`), so a re-run after a partial failure is safe.
- Every `check` constraint and every index described in [schema](schema.md) appears in a migration;
  a constraint that exists only in documentation does not exist.
- RLS enablement and policy creation are migrations, not manual console steps. A policy applied by
  hand in the console is a policy that will be missing in the next environment.
- `cron.schedule` registration is a migration ([cron R-CR-1](../06-jobs/cron.md#r-cr-1-registered-schedules-s1)),
  so the schedules exist in every environment by construction.
- Migrations must not contain secrets. Seed data for `packages` contains prices, which are
  application data and are fine; a Vault secret is not.

### R-MG-5 Ordering within the release `D`

Migrations → Edge Functions → SPA ([deployment R-DP-4](../01-architecture/deployment.md#r-dp-4-release-sequence-d)).
The database must be ready before code reads it, and code must be ready before the client calls it.

### R-MG-6 Verification `D`

- Migrations apply cleanly to an empty database and produce the documented schema.
- The resulting schema is asserted: constraint presence, index presence, RLS enablement, grant state.
  Assertion by inspection does not survive the tenth migration.
- Migrations apply cleanly in CI on every pull request, against a fresh database.

## Security considerations

- **Policies in migrations, never in the console** (R-MG-4). A manually-applied policy is the most
  common way a staging environment ends up more permissive than production.
- **Constraints are security controls.** `check (currency = 'USD')` and the provider-scoped unique
  indexes enforce business invariants that no amount of code review guarantees.
- **Forward-only with expand-then-contract preserves rollback**, which is a security property.
- **Audit-log triggers ship with the tables they protect.** A table created without its audit trigger
  is a window of unaudited privileged mutation.
- **No secrets in migration files.** They are committed, reviewed, and readable by anyone with
  repository access.

## Acceptance criteria

- [ ] Every migration is preceded by a corresponding [schema](schema.md) update in the same PR.
- [ ] Migrations apply cleanly to an empty database in CI.
- [ ] The applied schema is asserted against the documented constraints, indexes, and policies.
- [ ] No migration contains a secret.
- [ ] No migration references a legacy table or column name.
- [ ] RLS is enabled on every tenant-owned table by migration, verified in a fresh environment.
- [ ] Both cron schedules exist after a fresh migration run.
- [ ] No release combines a column drop with the code change that stops using it.

## Related skills

- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) — migration
  structure and index creation.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — automate the sequence.
- [`release-it`](../SKILLS.md#release-it) — expand-then-contract and rollback.

## Open decisions

- **OD-MG-1** Migration tooling: Supabase CLI migrations, or another runner. Tagged `D`.
- **OD-MG-2** Whether preview environments get a branched database or a shared one (shared with
  OD-DP-1).
- **OD-MG-3** Whether `packages` seed data lives in a migration or is inserted by an admin at setup.
  Recommend a migration, so prices cannot drift between environments.
