# Test Strategy

## Purpose

Define what is tested, at which layer, with which tool, and what "verified" is allowed to mean. This
document exists so that a claim of production readiness is backed by an executed check rather than
by confidence.

## Scope

In scope: test layers, the mandated command set, the specific test categories the brief requires, and
the honesty rule about unavailable checks. Out of scope: the RLS matrix itself
([rls-verification](rls-verification.md)) and release gating ([production-checklist](production-checklist.md)).

## Source of truth

- `S1` Strategic brief — Bun as the repository-standard runner, the five required commands, and the
  nine required additional checks.
- Verified environment state (this session): `bun 1.4.0` installed via npm; `bun.sh` is unreachable
  from this sandbox; `node v22.22.3` and `npm 10.9.8` present.
- `D` Test design proposed here.

## Requirements

### R-TS-1 Runner and commands `S1`

Bun is the repository-standard runner. These five commands must pass:

```bash
bun install
bun tsc -b --noEmit
bun test
bun run lint
bun run build
```

They are wired into CI on every pull request. A branch that cannot run them is not mergeable.

> Environment note, verified this session: `bun --version` returns `1.4.0`, installed with
> `npm install -g bun` because `https://bun.sh/install` is unreachable from this sandbox
> (`curl` returns `000`). This is recorded so that a future contributor who hits the same wall does
> not conclude the toolchain is broken. It is **not** a limitation of the repository.

### R-TS-2 Test layers `D`

| Layer | What it covers | Tool | Speed |
| --- | --- | --- | --- |
| Unit — domain core | Scoring, evidence validation, deduplication, quota arithmetic, state transitions. Pure functions, no I/O. | `bun test` | Milliseconds |
| Contract | Request/response shapes between SPA and Edge Functions | `bun test` | Milliseconds |
| Database | Schema constraints, triggers, RLS policies | SQL harness against a local Supabase Postgres | Seconds |
| Integration | Edge Function handlers against a real database | `bun test` + local Supabase | Seconds |
| End-to-end | Checkout, dashboard, admin flows | Playwright | Minutes |
| Static | Types, lint, import boundaries, secret scan | `tsc`, linter, scanner | Seconds |

The ordering is deliberate. Unit tests are written **before** integration, as the brief requires for
Phase 3: a pure scoring function is testable in isolation, and testing it through a database makes
failures ambiguous.

### R-TS-3 Mandated additional checks `S1`

| Check | How it is executed | Blocks release |
| --- | --- | --- |
| RLS verification | Per-table, per-role matrix in [rls-verification](rls-verification.md) | Yes |
| Tenant-isolation tests | Cross-tenant read/write attempts from both directions, expecting zero rows and `404` | Yes |
| Payment idempotency tests | Same provider event delivered sequentially and concurrently; assert one ledger row, one entitlement change | Yes |
| Webhook replay tests | Valid-but-old transmission, duplicate event id, bad signature | Yes |
| Access-state tests | Each of the five states exercised against each gated surface | Yes |
| Cron/job recovery tests | Killed worker, expired lease, duplicate cron fire, failing unit in a batch | Yes |
| Accessibility checks | Automated axe scan plus keyboard-only navigation of every route | Yes |
| Mobile visual checks | Responsive pass at 360px, 768px, 1440px on every route | Yes |
| Secret exposure scan | Build artifacts and source, for keys, tokens, and service-role patterns | Yes |
| Currency integrity tests | Non-USD insert rejected for every role; negative `amount_usd` rejected; `IDR`/`fx_rate`/`exchange_rate`/`USD_TO_IDR`/`rupiah` appear only inside exclusion documentation and are never defined as a field; charged amount equals `packages.price_usd` for all three plans; no floating-point money type | Yes |
| Exclusion scan | `convex`, `mayar`, `midtrans`, `stripe` absent from the dependency tree and from source outside exclusion docs | Yes |

Every one of these must be an automated, executed check. A manual walkthrough recorded in a document
is not a check.

### R-TS-4 State-variant coverage `S1`

Every UI route must be exercised in each of these states. A route is not "done" when the happy path
renders.

| State | Assert |
| --- | --- |
| Loading | A visible pending affordance; no flash of empty |
| Empty | A distinct empty message that is not the error message |
| Partial | Some data present, some failed; the failure is labelled, not hidden |
| Failed | An error state with the reason |
| Retryable error | A working retry control that actually re-fetches |
| Mutation pending | The control is disabled and progress is visible |
| Success | Confirmation is visible and the underlying data reflects the change |
| Stale data | The staleness is indicated rather than presented as current |

These are tested as components with injected states, not discovered by breaking a live backend.

### R-TS-5 Test data `S1`

- **No dummy production data.** Fixtures are explicit, labelled, and confined to test scope. No
  invented company names presented as real Signals, no fabricated testimonials, logos, or scarcity
  claims anywhere in the product or its tests.
- Fixtures for payment tests use PayPal sandbox identifiers only, and never a real customer's data.
- Any seeded demonstration content is visibly marked as such and cannot reach a production tenant.

### R-TS-6 The honesty rule `S1`

> *"Do not claim production readiness if any required check is unavailable. Document the exact
> limitation."*

Operationalized:

1. Every check in R-TS-1 and R-TS-3 has a status: `passing`, `failing`, or `unavailable`.
2. An `unavailable` check must name the specific blocker — the missing service, the absent
   credential, the platform capability that does not exist here.
3. `unavailable` blocks the production-readiness claim exactly as `failing` does. It is not a
   softer state.
4. The limitation is recorded in [production-checklist](production-checklist.md), not buried in a
   commit message.

This rule is the reason [forensic-audit](../00-product/forensic-audit.md) states plainly that the
audit could not be performed instead of approximating it.

### R-TS-7 What is deliberately not tested `D`

- Third-party provider internals. PayPal's settlement behaviour is not ours to test; our contract
  with it is. Tests mock the provider and assert *our* handling.
- Supabase platform behaviour. RLS evaluation semantics are Supabase's; our *policies* are ours and
  are tested against a real Postgres.
- Model output quality. The model's judgement is not deterministic and is not asserted. What is
  asserted is that whatever it returns is structurally validated, evidence-gated, and scored
  deterministically.

## Security considerations

- Tenant-isolation and RLS tests are security tests and are treated as gates, not as quality
  niceties.
- Test fixtures must not contain real credentials. Sandbox credentials live in environment variables,
  never in committed files.
- The secret exposure scan runs against **build artifacts**, because a secret can be absent from
  source review and still present in a bundle via an environment inlining mistake.
- Accessibility checks are included in the security-adjacent gates deliberately: an inaccessible
  error state is a state a user cannot act on, which in a payment flow has real consequences.

## Acceptance criteria

- [ ] All five R-TS-1 commands pass locally and in CI on a clean checkout.
- [ ] Every check in R-TS-3 has an automated implementation with a recorded status.
- [ ] Domain-core unit tests exist and pass **before** the corresponding integration tests are
      written (Phase 3 ordering).
- [ ] Every UI route has a test for each of the eight states in R-TS-4.
- [ ] No committed fixture contains a credential or invented production data.
- [ ] `production-checklist` records a status for every gate, with `unavailable` entries naming the
      exact blocker.
- [ ] CI fails the build on any `failing` gate and refuses the readiness label while any gate is
      `unavailable`.

## Related skills

- [`pragmatic-programmer`](../SKILLS.md#pragmatic-programmer) — test the contract, not the implementation.
- [`clean-code`](../SKILLS.md#clean-code) — one assertion intent per test.
- [`release-it`](../SKILLS.md#release-it) — gates that block a release; honest status reporting.
- [`ux-heuristics`](../SKILLS.md#ux-heuristics) — the state-variant coverage in R-TS-4.
- [`supabase-postgres-best-practices`](../SKILLS.md#supabase-postgres-best-practices) — testing
  policies against real Postgres.

## Open decisions

- **OD-TS-1** Which SQL test harness is standard: pgTAP inside Postgres, or SQL scripts driven from
  `bun test`. Both are viable; the choice affects how RLS verification is written. Tagged `D`.
- **OD-TS-2** Whether CI provisions a full local Supabase stack (requires Docker) or tests against an
  ephemeral hosted project. Determines whether RLS verification runs on every PR or only pre-merge.
  Tagged `D`.
- **OD-TS-3** Playwright versus an alternative for the end-to-end and mobile visual checks. Tagged `D`.
- **OD-TS-4** Coverage threshold, if any. A number chosen without a baseline is arbitrary; recommend
  measuring first, then setting one. Tagged `D`.
