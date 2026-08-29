# Deduplication

## Purpose

Specify how the pipeline avoids publishing the same underlying event twice, and how it distinguishes
a duplicate from a material update.

## Scope

In scope: the deduplication stage, its scope, and the boundary between duplicate and update. Out of
scope: scoring ([scoring](scoring.md)) and validation ([validation](validation.md)).

## Source of truth

- `S1` Strategic brief — deduplication is a named pipeline stage between evidence verification and
  scoring.
- `S3` Legacy deduplication implementation — **not available**. Identity keys, thresholds, and
  material-update semantics are `X`.
- `D` Design decisions proposed here.

## Requirements

### R-DD-1 It is a stage `S1`

Deduplication is an explicit pipeline stage, not an implicit side effect of the writer. It runs
after evidence verification and before scoring, so that no compute is spent scoring a row that will
be discarded.

### R-DD-2 Scope is the tenant `D`

Deduplication is organization-scoped (BR-DD-03). Two tenants may legitimately hold Signals about the
same real-world company; suppressing the second would deprive one customer of a signal they paid for.
A global deduplication index would also be a cross-tenant information channel — knowing that tenant
B already received a Signal about company X leaks tenant B's monitoring scope to tenant A.

This is why the uniqueness constraint is composite on `organization_id`, and why a global uniqueness
index on subject would be a security defect rather than an optimization.

### R-DD-3 Effect `D`

A duplicate must not create a second published Signal for the same underlying event within the same
organization (BR-DD-02). What happens instead — skip silently, attach new evidence to the existing
Signal, or supersede — depends on the material-update decision below and is not decided here.

### R-DD-4 Identity and threshold `X`

**Not defined and not invented:**

| Question | ID |
| --- | --- |
| The identity key deciding "same event" | BR-DD-04 |
| Similarity threshold and the algorithm applying it | BR-DD-05 |
| What makes new information a *material update* rather than a new Signal | BR-DD-06 |
| Whether a material update re-scores in place, appends, or supersedes | BR-DD-07 |

These four questions block the deduplication stage and the corresponding uniqueness constraint. They
are recorded as **B-4**.

The reason this document does not propose a plausible-looking answer: a similarity threshold is a
product trade-off between two visible failure modes. Too strict and customers see the same event
repeatedly, which erodes trust in the product's intelligence. Too loose and genuinely distinct events
are suppressed, which erodes trust in its coverage. Either error is defensible if chosen; neither is
defensible if assumed.

### R-DD-5 Ordering guarantee `D`

Deduplication must be deterministic under concurrent workers. Two workers processing related
candidates for the same organization must converge on the same survivor. This requires the
survivor-selection rule to be a total order over candidates (for example, earliest evidence, then
stable id), not "whichever wrote first".

### R-DD-6 Interaction with immutability `D`

A duplicate detected against an already-published Signal cannot modify it
([signal-model R-SG-4](signal-model.md#r-sg-4-immutability-d)). The options are therefore limited to:
discard the duplicate, or publish a superseding Signal. Silent in-place modification is excluded by
design.

## Security considerations

- **Tenant-scoped deduplication is a confidentiality control**, not only a quality control (R-DD-2).
  A shared index would leak one tenant's monitoring interests to another.
- Deduplication runs on untrusted, externally-sourced content. A crafted source could attempt to
  force collisions and suppress a competitor's Signal for a target tenant. Deterministic
  survivor selection (R-DD-5) limits the damage; the identity-key decision should account for it.
- Deduplication decisions are auditable: which candidate survived and why should be reconstructable,
  because "why didn't I get a Signal about X?" is a support question that will be asked.

## Acceptance criteria

- [ ] The same event processed twice for one organization produces exactly one published Signal.
- [ ] The same event for two different organizations produces one published Signal each.
- [ ] Survivor selection is deterministic: two concurrent workers converge on the same result.
- [ ] No cross-tenant deduplication lookup exists — verified by review and by a test asserting no
      query joins `signals` across organizations.
- [ ] Deduplication never modifies a published Signal.
- [ ] The uniqueness constraint includes `organization_id`.

## Related skills

- [`ddia-systems`](../SKILLS.md#ddia-systems) — convergent conflict resolution under concurrency.
- [`clean-architecture`](../SKILLS.md#clean-architecture) — deduplication as domain policy.
- [`system-design`](../SKILLS.md#system-design) — ordering before expensive work.

## Open decisions

- **B-4 / OD-BR-5** Identity key and similarity threshold. **Blocks the deduplication stage.**
- **OD-BR-4** Material-update definition.
- **OD-DD-1** Supersede versus append on material update (BR-DD-07).
- **OD-DD-2** Whether customers can see that a Signal superseded an earlier one.
- **OD-DD-3** Whether deduplication decisions are retained for audit and for how long.
