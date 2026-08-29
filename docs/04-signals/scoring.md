# Scoring

## Purpose

Specify the scoring model: the weights, the bands, the determinism requirement, and precisely which
parts are fixed by the brief and which parts remain undefined.

## Scope

In scope: the arithmetic, the bands, and the enforcement of determinism and immutability. Out of
scope: what each component means in the domain (that is `X`) and the Signal shape
([signal-model](signal-model.md)).

## Source of truth

- `S1` Strategic brief — the six components, their weights, the four bands and their ranges, the
  requirement for deterministic scoring, and the prohibition on frontend recomputation.
- `S3` Legacy scoring implementation — **not available**. Component input definitions, decay curves,
  and tie-breaking are therefore `X`.
- `D` Normalization and rounding proposals.

## Requirements

### R-SC-1 Components and weights `S1`

| Component | Weight |
| --- | --- |
| `account_fit` | 25% |
| `signal_strength` | 25% |
| `freshness` | 15% |
| `buyer_relevance` | 15% |
| `commercial_scale` | 10% |
| `evidence_quality` | 10% |
| **Total** | **100%** |

The weights are fixed product policy. They are not tenant-configurable and not
environment-configurable; changing them is a product decision that changes every customer's scores.

### R-SC-2 Bands `S1`

| Band | Range |
| --- | --- |
| `HIGH` | 80–100 |
| `MEDIUM` | 60–79 |
| `WATCH` | 30–59 |
| `LOW` | 0–29 |

Inclusive on both ends, partitioning 0–100 with no gap and no overlap. The band is derived at write
time and stored (BR-SC-14), so a band change requires a product decision plus a data migration —
never a silent read-time reinterpretation.

### R-SC-3 Arithmetic `D`

```
each component cᵢ ∈ integers 0..100
score = round( Σ (weightᵢ × cᵢ) / 100 )
band  = f(score)   per R-SC-2
```

Proposed because the brief fixes the weights but not the scale. Requiring integer 0–100 components
makes the score reproducible exactly and makes `score_components` human-readable in the UI's
`SCORE EXPLANATION` section. **Needs approval — OD-SC-1.**

A `check` constraint enforces `score between 0 and 100`; an out-of-range value is rejected at write,
never clamped (BR-SC-15). Clamping hides the bug that produced the value.

### R-SC-4 Determinism `S1` + `D`

Same inputs → same score and band. Concretely:

| Permitted input | Prohibited input |
| --- | --- |
| Candidate attributes | Time of day |
| Evidence attributes and verification status | Random values |
| Monitoring profile attributes | Model temperature or free-text model output |
| Published constants | Anything tenant-configurable |

Model output may *inform* the inputs (for example, an extracted company size), but the arithmetic
itself is pure. A model never returns a score. This separation is what makes a score explainable:
the `SCORE EXPLANATION` section can show the six components and the customer can follow the math.

### R-SC-5 Computed server-side, rendered client-side `S1`

The frontend never computes, recomputes, adjusts, or re-derives a score or band (BR-SC-12). It reads
`score`, `score_band`, and `score_components` and renders them. Enforced by:

- **No `UPDATE` policy on `signals` at all** for any client role — row-level denial, so no column of
  a Signal is writable by a customer.
- **Column `REVOKE`** on `score`, `score_band`, `score_components`, and `published_at` for
  `authenticated`, so the fields are not writable even where a row is.
- **A `BEFORE UPDATE` trigger** that raises if a published Signal's score or components change, which
  also stops a privileged writer from doing it by accident.
- **A `CHECK` constraint** rejecting a score outside 0–100 and requiring all six component keys.
- **Import-boundary lint**, so the SPA cannot import the domain-core scoring module.
- **Test**: a fixture with known components asserts the rendered value equals the stored value.

Note that the trigger and the `REVOKE`, not RLS, are what make the score immutable. An RLS policy has
no column granularity; see [schema R-DB-6](../02-database/schema.md#r-db-6-what-rls-does-and-does-not-protect-s1).

A client that could recompute a score could also display a different one than the server holds,
which is how a product ends up arguing with its own customer about a number.

### R-SC-6 Immutability `D`

Score and components are final at publication (BR-SC-11, BR-SG-06). Correction supersedes; it does
not mutate.

### R-SC-7 Component definitions `X`

**The following are not defined and must not be invented:**

| Component | Undefined |
| --- | --- |
| `account_fit` | What evidence drives it; its 0–100 mapping (BR-SC-20) |
| `signal_strength` | What drives it; its mapping (BR-SC-21) |
| `freshness` | The decay curve — half-life and floor (BR-SC-22) |
| `buyer_relevance` | What makes a signal relevant to a given monitoring profile (BR-SC-23) |
| `commercial_scale` | How scale is estimated — revenue band, headcount, deal size (BR-SC-24) |
| `evidence_quality` | How a source is graded — authority, primary vs secondary, recency (BR-SC-25) |
| All | Tie-breaking and ordering of equal scores (BR-SC-26) |

This is the largest single gap in the documentation set and it blocks Phase 3, because the scoring
module is the heart of the signal domain. It is recorded as **B-3**.

## Security considerations

- Score immutability comes from the column `REVOKE` and the trigger, reinforced by the absence of any
  customer `UPDATE` policy on `signals`. Together they mean **a customer cannot inflate their own
  Signals**. Any path that permits it is a privilege escalation with direct commercial consequence.
- Determinism is a security property here: an attacker who can influence a score input can influence
  what a customer is told to act on. Keeping the arithmetic pure and its inputs validated
  ([validation](validation.md)) limits that surface.
- Band boundaries are business-visible. A stored band that disagrees with its score is a
  data-integrity alarm, and should be caught by a test, not by a customer.

## Acceptance criteria

- [ ] Unit tests cover every band boundary: 0, 29, 30, 59, 60, 79, 80, 100.
- [ ] A score of 101 or −1 is rejected by the database.
- [ ] A Signal missing any of the six components cannot be persisted.
- [ ] Identical inputs produce identical scores across repeated runs, asserted by test.
- [ ] The SPA cannot import the scoring module — enforced by lint, verified by a failing-build test.
- [ ] A customer `UPDATE` on `signals.score` is denied, and the denial is attributed to the column
      `REVOKE` rather than to an RLS policy.
- [ ] A privileged role holding column privileges still cannot change a published Signal's score; the
      trigger raises.
- [ ] The rendered `SCORE EXPLANATION` matches the stored components exactly.

## Related skills

- [`clean-architecture`](../SKILLS.md#clean-architecture) — scoring is pure domain policy.
- [`clean-code`](../SKILLS.md#clean-code) — one pure function, exhaustively tested.
- [`ddia-systems`](../SKILLS.md#ddia-systems) — determinism and reproducibility.

## Open decisions

- **B-3 / OD-BR-3** Component definitions. **Blocks Phase 3.**
- **OD-SC-1** Approve the normalization in R-SC-3.
- **OD-SC-2** Tie-breaking rule (BR-SC-26).
- **OD-SC-3** Whether a weight change requires re-scoring historical Signals or applies only going
  forward. Recommend forward-only, but it is a product decision.
