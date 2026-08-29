# Legacy Exclusion List

## Purpose

The single authoritative list of everything excluded from v2 — legacy platforms, legacy payment
providers, and legacy currency handling — so that each absence is a decision rather than an
oversight, and a reviewer can reject a pull request that reintroduces one.

Every entry is marked **LEGACY — EXCLUDED**. Nothing on this list may appear in the schema, the code,
the configuration, or the dependency tree. The only permitted occurrence of these names is in this
document and in other documents that state the exclusion.

## Scope

In scope: prohibited technologies, prohibited patterns, and legacy artefacts deliberately left
behind. Out of scope: what *is* carried over — that is business rules only, recorded in
[business-rules](../00-product/business-rules.md).

## Source of truth

- `S1` Strategic brief — the prohibition list and the "do not" operating rules. Both are reproduced
  below verbatim in intent.
- `S2`/`S3` Legacy repository — **not available**. This means the inventory below is complete with
  respect to *what the brief prohibits*, but **not** complete with respect to *what the legacy
  repository actually contained*. A full carryover inventory requires the legacy source. See
  [forensic-audit](../00-product/forensic-audit.md). This is recorded as a limitation, not hidden.

## Requirements

### R-LC-1 Prohibited technologies `S1`

| Item | Status in v2 | Reason |
| --- | --- | --- |
| Convex | **Not present.** No dependency, no config, no code. | Replaced wholesale by Supabase. A second backend recreates the mixed architecture this rebuild exists to remove. |
| `@convex-dev/auth` | **Not present.** | Supabase Auth is the sole identity provider. |
| Convex cron | **Not present.** | Supabase Cron is the scheduler. |
| Mayar | **Not present.** No adapter, client, config, column, or type. | Replaced by PayPal. No Mayar customers require migration. |
| Midtrans | **Not present.** | Not a v2 provider. |
| Stripe, including any "legacy path" | **Not present in any form.** | PayPal is the sole customer checkout provider. |

Note on the Stripe wording: the brief lists `Stripe legacy path` among prohibited items while also
naming PayPal as the sole provider. Resolved under precedence rule 2 — Stripe is not implemented at
all, in any path. A partial Stripe integration kept "for compatibility" would violate both statements.

### R-LC-2 Prohibited patterns `S1`

| Pattern | Status | Replacement |
| --- | --- | --- |
| Browser cron / client-scheduled work | **Prohibited** | Supabase Cron → Edge Function dispatch |
| Client-side secret | **Prohibited** | Supabase Vault, read server-side per invocation |
| Public test or debug checkout action | **Prohibited, all environments** | Real flow against PayPal sandbox |
| Legacy migration compatibility layer | **Prohibited** | Clean schema; no adapters for absent systems |
| Fake adapters preserving legacy shapes | **Prohibited** | Interfaces designed for v2 providers only |
| Business rules implemented in React | **Prohibited** | Pure domain core, server-executed |
| RLS bypass | **Prohibited** | RLS plus explicit Edge Function authorization |
| Blind copying of legacy code | **Prohibited** | Rules re-expressed from documentation, then re-implemented |
| Frontend route hiding as authorization | **Prohibited** | Server-side authorization at every layer |
| Incremental migration from the old repository | **Prohibited** | Rebuild from scratch |

### R-LC-3 Legacy artefacts deliberately left behind `D`

| Artefact | Disposition |
| --- | --- |
| Convex schema and functions | Not carried. Schema designed from requirements ([schema](../02-database/schema.md)). |
| Mayar webhook handler and client | Not carried. PayPal handler designed fresh ([paypal](../05-billing/paypal.md)). |
| Legacy migration files | Not carried and not replayed. v2 migrations start from an empty database. |
| Legacy global `transaction_id` column | **Deliberately absent.** Replaced by provider-scoped uniqueness (INV-9, INV-10). |
| Legacy payment records | Not migrated. The brief states no production payment data must be preserved. |
| Legacy customer accounts | Not migrated. The brief states no Mayar customers require migration. |
| Legacy UI components and design tokens | Not copied. v2 implements the Clean Clay design system from the PRDs (which are currently unavailable — see OD-LC-2). |
| Legacy environment configuration | Not reused. New Supabase project, new Vault entries, new Vercel project. |
| Legacy secrets | **Not reused.** Every credential is issued new. Reusing a legacy secret would import its exposure history. |

### R-LC-4 Detection `D`

Prohibitions that rely on reviewer memory will fail. Automated detection is required:

| Check | Fails on |
| --- | --- |
| Dependency scan | Any package named or matching `convex`, `mayar`, `midtrans`, `stripe` |
| Source scan | Any occurrence of those names outside prohibition documentation |
| Import-boundary lint | SPA importing domain-core or adapter modules |
| Bundle scan | Service-role key or any secret pattern in build output |
| Route inventory | Any route matching a test/debug checkout pattern |
| Migration review | Any migration referencing a legacy table or column name |
| Currency scan | Any `IDR`, `amount_idr`, `fx_rate`, `exchange_rate`, `USD_TO_IDR`, or `rupiah` occurrence **outside exclusion documentation**, or defined as a schema field |
| Schema scan | Any monetary column without `check (currency = 'USD')`, or using a float type |

### R-LC-5 Excluded currency handling `S1`

Legacy currency constructs are excluded along with the legacy platforms. USD is the only currency;
see [currency-and-cost-policy](currency-and-cost-policy.md).

| Identifier | Status | Note |
| --- | --- | --- |
| `IDR` | **LEGACY — EXCLUDED** | No rupiah anywhere: no column, constant, or display path |
| `amount_idr` | **LEGACY — EXCLUDED** | No dual-currency amount column |
| `fx_rate` | **LEGACY — EXCLUDED** | No rate column |
| `exchange_rate` | **LEGACY — EXCLUDED** | No rate column |
| `USD_TO_IDR` | **LEGACY — EXCLUDED** | No rate constant |
| Currency conversion | **LEGACY — EXCLUDED** | No conversion function, service, module, or helper |
| Country-based conversion | **LEGACY — EXCLUDED** | Currency is never derived from country, locale, IP, or browser language |
| FX table / rate cache | **LEGACY — EXCLUDED** | No storage of rates, historical or current |

**Verified state.** These identifiers appear in this repository **only as entries in this exclusion
list and in [currency-and-cost-policy](currency-and-cost-policy.md)** — that is, only as statements
that they are excluded. They appear in **no schema field, no constant, no code identifier, and no
configuration value**, and the repository currently contains no non-markdown files at all.

Nothing on this list required deletion, because nothing on it was ever introduced. Whether the legacy
system used IDR is unknown ([gap register](legacy-audit-gap-register.md)) and does not matter: v2
carries no currency handling forward, so there is nothing to migrate and nothing to convert.

The gate (R-LC-4) enforces "no occurrence outside exclusion documentation" and "never defined as a
field" — not "zero hits", which would fail against this document itself.

This is recorded explicitly rather than left unsaid: whether or not the legacy system handled IDR is
unknown ([gap register](legacy-audit-gap-register.md)), and **it does not matter** — v2 does not
carry currency handling forward in any form, so there is nothing to migrate and nothing to convert.

## Security considerations

- **Legacy secrets are not reused** (R-LC-3). A secret carried over from a deprecated system carries
  an unknown exposure history; rotating everything is cheaper than establishing that history.
- **No compatibility layer** removes a large class of confused-deputy bugs: an adapter that accepts
  two providers' shapes is an adapter that can be fed either one by an attacker.
- **A single provider** shrinks the payment attack surface to one webhook contract, one signature
  scheme, and one reconciliation path.
- **The detection checks are the control.** The prohibition list without automation is a preference.

## Acceptance criteria

- [ ] `bun install` resolves with no prohibited dependency in the tree, including transitive.
- [ ] A source scan for `convex|mayar|midtrans|stripe` returns only documentation of the exclusion.
- [ ] `IDR`, `amount_idr`, `fx_rate`, `exchange_rate`, `USD_TO_IDR`, and `rupiah` occur only inside
      exclusion documentation, and are never defined as a field, constant, or identifier.
- [ ] No monetary column lacks `check (currency = 'USD')`.
- [ ] The detection checks in R-LC-4 and R-LC-5 run in CI and fail the build.
- [ ] No route, handler, or function name matches a test/debug checkout pattern in any environment.
- [ ] No migration file references a legacy table or column.
- [ ] No credential in the v2 environment matches a legacy credential.
- [ ] The detection checks in R-LC-4 run in CI and fail the build.

## Related skills

- [`clean-architecture`](../SKILLS.md#clean-architecture) — boundaries that make reintroduction impossible.
- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — automate the rule rather than trust memory.
- [`release-it`](../SKILLS.md#release-it) — a clean cutover beats a long dual-running migration.

## Open decisions

- **OD-LC-1** This inventory cannot be confirmed complete without the legacy repository. When it is
  supplied, re-run the audit and add any additional artefacts found. Tagged `X`.
- **OD-LC-2** The Clean Clay design system is referenced by the brief but its definition lived in the
  legacy `DESIGN.md`, which is unavailable. Until it is supplied, UI work in Phase 5 has no
  authoritative visual source. Tagged `X`.
- **OD-LC-3** Whether the legacy repository is archived or deleted once v2 is live. Tagged `D`.
