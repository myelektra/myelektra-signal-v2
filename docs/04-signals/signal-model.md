# Signal Model

## Purpose

Define the Signal as a domain object: its identity, its required content, its lifecycle, and the rule
that governs whether it may be published at all.

## Scope

In scope: the Signal's shape, the publication gate, and the pipeline that produces it. Out of scope:
scoring arithmetic ([scoring](scoring.md)), evidence rules ([evidence](evidence.md)), validation
([validation](validation.md)), and deduplication ([deduplication](deduplication.md)).

## Source of truth

- `S1` Strategic brief — the pipeline stage order, the required content of a published Signal, and
  the publication rule.
- `S3` Legacy signal implementation — **not available**. The lifecycle state machine is therefore
  `X`, not reconstructed.
- `D` Design decisions proposed here.

## Requirements

### R-SG-1 Pipeline `S1`

```
candidate discovery
  ↓
cheap filtering          reject inexpensive failures before spending model tokens
  ↓
AI validation
  ↓
structured validation    schema-conform, complete, internally consistent
  ↓
evidence verification
  ↓
deduplication
  ↓
deterministic scoring
  ↓
persist signals
  ↓
build daily read model
  ↓
delivery
```

Stage order is normative. Two consequences worth stating:

- **Cheap filtering precedes AI validation.** This is a cost control with product consequences: it
  determines how many candidates the model sees, and therefore the run's cost ceiling.
- **Scoring precedes persistence, and deduplication precedes scoring.** Scoring a duplicate wastes
  work and, worse, could let two rows compete on score for the same underlying event.

### R-SG-2 Required content `S1`

A published Signal must carry all of:

| Field | Notes |
| --- | --- |
| Company / event | `subject_name` |
| Signal type | Taxonomy `X` (OD-BR-2) |
| Source name | On the evidence row |
| Source URL | On the evidence row |
| Evidence summary | |
| Publication date | **If available** — absence stays visible, never defaulted to today |
| Freshness | Enumeration `X` |
| Confidence | Enumeration `X` |
| Commercial implication | |
| Recommended action | |
| Score | 0–100 |
| Score components | All six |
| Limitations | **If any exist** — the field may be empty but must not be hidden |

The "if available" and "if any" qualifiers are requirements, not courtesies. A publication date
silently defaulted to today fabricates recency, which inflates freshness, which inflates the score.
That is a data-integrity failure with a commercial consequence.

### R-SG-3 Publication gate `S1`

**No evidence, no published Signal.** Enforced three ways:

1. A database trigger rejects setting `published_at` when no verified evidence row exists
   ([schema](../02-database/schema.md#r-db-3-core-entities-d)).
2. The pipeline cannot reach the persist stage without passing evidence verification.
3. No write path outside the pipeline can publish (BR-SG-05).

Enforcing it in the database matters because the other two are code, and code paths get added.

### R-SG-4 Immutability `D`

Once published, a Signal's score and components are final (BR-SC-11, BR-SG-06). Correction produces a
new Signal that supersedes the old, not a mutation. Rationale: a customer who acted on a score must
be able to trust that the number they saw is the number that was computed. Silent re-scoring
destroys that, and destroys the audit trail with it.

### R-SG-5 Lifecycle `X`

The state machine between discovery and publication/discard is **not defined** and is not
recoverable without the legacy repository (BR-SG-08). Also undefined: whether a rejected candidate is
retained for audit or discarded (BR-SG-09).

This document does not propose a state machine, because doing so would silently resolve a product
question. What is asserted is the boundary condition: nothing before `persist` is a Signal, and
nothing without verified evidence is published.

### R-SG-6 Tenancy `S1`

Every Signal carries `organization_id` (INV-1) and is visible only within its tenant
([rls](../02-database/rls.md#r-rl-3-policy-matrix-s1--d)). Two tenants may hold Signals about the
same real-world company; deduplication is tenant-scoped (BR-DD-03).

### R-SG-7 Determinism `D`

The Signal is the output of a deterministic function of its inputs. Given identical candidate data
and identical evidence, the pipeline produces the identical score and band. This is what makes the
product defensible when a customer asks why a Signal scored 78.

## Security considerations

- The publication gate is a **trust control**, not a data-quality nicety. A Signal without evidence
  is an unsupported commercial claim sold to a customer.
- `published_at` and `score` are write-denied to customers
  ([rls](../02-database/rls.md#r-rl-4-restricted-columns-s1)); a customer cannot manufacture or
  inflate a Signal.
- Candidate data is derived from external sources and is untrusted until structurally validated
  ([validation](validation.md)).
- Signals are customer-readable but pipeline-owned. The customer sees the result, never the
  intermediate `signal_jobs` rows or their `last_error` text.

## Acceptance criteria

- [ ] Publishing a Signal with zero verified evidence rows raises a database error.
- [ ] A Signal missing any field in R-SG-2 cannot be persisted.
- [ ] An absent source publication date is stored as null and rendered as absent, not as today.
- [ ] A Signal's score cannot be changed by any request path after publication.
- [ ] Identical inputs produce identical scores across repeated runs.
- [ ] A Signal is never visible outside its organization, in either direction.

## Related skills

- [`clean-architecture`](../SKILLS.md#clean-architecture) — the Signal is the domain aggregate.
- [`clean-code`](../SKILLS.md#clean-code) — make illegal states unrepresentable.
- [`ddia-systems`](../SKILLS.md#ddia-systems) — determinism and reproducibility.

## Open decisions

- **OD-BR-2** Signal type taxonomy. Blocks the `signal_type` enumeration.
- **OD-SG-1** The lifecycle state machine (BR-SG-08) and rejected-candidate retention (BR-SG-09).
- **OD-SG-2** Whether superseded Signals remain visible to the customer and for how long.
- **OD-DB-2** `confidence` and `freshness` enumerations.
