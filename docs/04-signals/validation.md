# Validation

## Purpose

Specify how a discovered candidate becomes trustworthy enough to be scored: cheap filtering, AI
validation, and structured validation — and what happens to the ones that fail.

## Scope

In scope: the three validation stages, their ordering, and failure handling. Out of scope: evidence
verification ([evidence](evidence.md)) and deduplication ([deduplication](deduplication.md)).

## Source of truth

- `S1` Strategic brief — the stage names and their order in the pipeline.
- `S3` Legacy validation implementation — **not available**. Criteria and rejection taxonomy are `X`.
- `S4` Provider documentation for the model and search APIs — must be verified.
- `D` Design decisions proposed here.

## Requirements

### R-VA-1 Stage order `S1`

```
candidate discovery
  ↓
cheap filtering        deterministic, no model call
  ↓
AI validation          model call, bounded and schema-constrained
  ↓
structured validation  schema conformance, completeness, internal consistency
  ↓
evidence verification
```

**Cheap filtering precedes AI validation** and this ordering is a hard requirement, not an
optimization. Every candidate that reaches the model costs money. Filtering first is what makes the
run's cost predictable and bounded.

### R-VA-2 Cheap filtering `D`

Deterministic rejections that need no model call. Candidates for this stage:

| Rejection | Why it is cheap |
| --- | --- |
| Missing subject name | Field presence |
| Missing or malformed source URL | Syntax check |
| URL on a disallowed scheme | Allowlist |
| Outside the organization's monitoring scope | Set membership |
| Duplicate of an already-published Signal | Tenant-scoped lookup |

The disallowed-domain list and the scope predicate are product decisions and are currently `X`.

### R-VA-3 AI validation `D`

A model call that judges whether the candidate is a genuine commercial signal rather than noise.
Constraints:

- The model's output is **constrained to a schema**. Free-text responses are not accepted.
- The model does **not** return a score. Scoring is deterministic and separate
  ([scoring](scoring.md#r-sc-4-determinism-s1--d)).
- The model's output is untrusted input: validated structurally, length-bounded, never executed.
- Token and call budgets are bounded per job, so one candidate cannot consume a run's budget.

### R-VA-4 Structured validation `D`

A deterministic gate after the model. The candidate must be schema-conform, complete with respect to
the fields in [signal-model R-SG-2](signal-model.md#r-sg-2-required-content-s1), and internally
consistent. Internal consistency includes:

- A claimed publication date is not in the future.
- Freshness is consistent with the publication date when both are present.
- Every referenced source exists on an evidence row.

Structural validation exists because a model can produce fluent, plausible, and wrong output. The
schema is the contract; the model is not.

### R-VA-5 Failure handling `D`

| Failure | Behaviour |
| --- | --- |
| Candidate rejected at any stage | Not published. Recorded per OD-SG-1. |
| Model call fails or times out | The job retries with backoff per [cron R-CR-5](../06-jobs/cron.md#r-cr-5-required-behaviours-s1). One candidate's failure must not fail the batch. |
| Model returns a schema-violating response | Treat as a rejected candidate, not as a job failure. Count it; alert if the rate rises. |
| Validation rate drops sharply | A pipeline-health signal, surfaced in admin **System health**. A silently degrading model produces a silently worse product. |

Failure isolation is mandatory: a single malformed candidate must not prevent the rest of the batch
from being processed.

### R-VA-6 Rejection taxonomy `X`

Why a candidate was rejected is **not defined** and is not recoverable without the legacy repository
(BR-SG-08, BR-SG-09). Whether rejections are retained for audit is also undefined (OD-SG-1).

This matters beyond tidiness: without a rejection taxonomy, "the pipeline found nothing today" and
"the pipeline is broken" are indistinguishable to an admin.

## Security considerations

- **Model output is untrusted.** It is validated structurally, length-bounded, and rendered as text.
  A prompt-injection attempt in scraped page content must not be able to steer extraction into
  publishing an attacker-chosen Signal.
- **URL fetching is an SSRF surface.** Cheap filtering's scheme allowlist must also reject internal,
  loopback, and link-local hosts before any fetch occurs.
- **Bounded budgets are a cost control with security implications.** An unbounded model spend per
  candidate turns a triggered cron run into an invoice.
- **Rejections must not leak.** A rejection reason may quote source content and must not be exposed
  to a customer or logged verbatim to a customer-visible surface.

## Acceptance criteria

- [ ] No model call is made for a candidate that cheap filtering would reject — asserted by call
      counting in tests.
- [ ] A model response violating the schema is recorded as a rejected candidate and does not fail the
      job.
- [ ] A model timeout retries with backoff and does not affect sibling candidates.
- [ ] A future-dated publication date fails structured validation.
- [ ] A candidate referencing a nonexistent evidence row fails structured validation.
- [ ] A scraped payload containing an injection attempt does not alter the extracted fields.
- [ ] Per-job token spend is capped and the cap is asserted by test.

## Related skills

- [`clean-architecture`](../SKILLS.md#clean-architecture) — the schema is the contract; the model is
  an adapter behind it.
- [`release-it`](../SKILLS.md#release-it) — bulkheads and failure isolation.
- [`system-design`](../SKILLS.md#system-design) — cost-aware stage ordering.

## Open decisions

- **OD-VA-1** The disallowed-domain list and the monitoring-scope predicate for cheap filtering.
- **OD-VA-2** The AI validation prompt and output schema. Requires the signal taxonomy (OD-BR-2).
- **OD-VA-3** Per-candidate and per-job token budgets.
- **OD-VA-4** Rejection taxonomy and retention (OD-SG-1).
- **OD-VA-5** Alert threshold for a falling validation success rate.
