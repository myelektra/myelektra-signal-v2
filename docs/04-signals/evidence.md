# Evidence

## Purpose

Specify evidence as the thing that makes a Signal publishable, and verification as the privileged act
that authorizes publication.

## Scope

In scope: the evidence record, verification semantics, and the gate evidence enforces. Out of scope:
scoring ([scoring](scoring.md)) and candidate validation ([validation](validation.md)).

## Source of truth

- `S1` Strategic brief — source name and URL as required content, the "no evidence, no published
  Signal" rule, and the prohibition on customers marking evidence verified.
- `S3` Legacy evidence implementation — **not available**. Thresholds and grading are `X`.
- `D` Design decisions proposed here.

## Requirements

### R-EV-1 Evidence is first-class `D`

Evidence is stored as rows linked to a Signal, not as prose embedded in it (BR-EV-01). Rationale: the
publication gate must be mechanically enforceable. "Does this Signal have verified evidence?" has to
be a query the database can answer, not a convention a developer remembers.

Each row carries: `source_name`, `source_url`, `evidence_summary`, `is_verified`, `verified_by`,
`verified_at`, plus `organization_id` (INV-1).

### R-EV-2 Resolvable source `S1`

`source_name` and `source_url` are both required and non-empty. A Signal whose source cannot be
navigated to cannot be checked by the customer, which defeats the purpose of showing evidence at all.

### R-EV-3 Verification is privileged `S1`

Customers cannot mark evidence verified (BR-EV-03). Enforced by:

- Column-level `GRANT` denial on `is_verified`, `verified_by`, `verified_at`
  ([rls](../02-database/rls.md#r-rl-4-restricted-columns-s1)).
- No `UPDATE` policy on `signal_evidence` for `CUSTOMER`.
- Verification performed only by the pipeline or by an authorized admin action, both audited.

Every verification records who and when (BR-EV-04). An anonymous verification is not an
accountability record.

### R-EV-4 The gate `S1`

Unverified evidence may exist; it may not be attached to a *published* Signal (BR-EV-05). Setting
`published_at` with zero verified evidence rows raises a database error
([schema](../02-database/schema.md#r-db-3-core-entities-d)).

### R-EV-5 Absence is visible `S1`

The source's publication date is included **when available** (BR-SG-03). Its absence is stored as
null and rendered as absent. It is never defaulted to the current date, because a fabricated
publication date inflates `freshness`, which inflates the score — a silent, compounding integrity
failure.

### R-EV-6 Untrusted origin `D`

Evidence content originates from external sources and, in part, from model extraction. It is
therefore untrusted input:

- Length-bounded before persistence.
- Rendered as text, never as HTML. A source page containing markup must not become a script in the
  customer's browser.
- Never executed, never interpreted as an instruction to the pipeline.

### R-EV-7 Undefined `X`

| Question | ID |
| --- | --- |
| Minimum number of independent sources required to publish | BR-EV-06 |
| What qualifies a source as authoritative enough to verify | BR-EV-07 |
| Behaviour when a source URL later 404s or is retracted | BR-EV-08 |
| Retention after a Signal is superseded | BR-EV-09 |
| How source quality maps to `evidence_quality` | BR-SC-25 |

None of these is invented here. Minimum-source count in particular is a product credibility decision:
setting it to 1 is a defensible choice with a stated trade-off, but it must be *chosen*, not assumed
by the absence of a constraint.

## Security considerations

- The evidence gate is the product's core trust control. Publishing an unevidenced Signal is
  equivalent to selling an unsupported commercial claim.
- Verification being privileged prevents a customer from self-certifying a Signal they want to act
  on or show to a colleague.
- **Stored-XSS surface.** `source_url` and `evidence_summary` come from the open web. R-EV-6's
  render-as-text rule is mandatory; a link must be validated as an `http(s)` URL before being made
  clickable, or a `javascript:` URL becomes an execution vector.
- `source_url` is fetched by the pipeline. That fetch is an SSRF surface and must reject internal and
  link-local addresses.

## Acceptance criteria

- [ ] A Signal with no verified evidence cannot be published — asserted by a database-level test.
- [ ] A customer `UPDATE` on `signal_evidence.is_verified` is denied for their own rows.
- [ ] Every verification writes `verified_by` and `verified_at`, and produces an audit entry.
- [ ] A missing source publication date is stored null and rendered as "date not available".
- [ ] `source_url` containing a non-`http(s)` scheme is not rendered as a link.
- [ ] Evidence text containing markup is rendered inert.
- [ ] The pipeline's URL fetch rejects internal, loopback, and link-local targets.

## Related skills

- [`clean-architecture`](../SKILLS.md#clean-architecture) — the gate belongs to the domain, not the UI.
- [`clean-code`](../SKILLS.md#clean-code) — make the invalid state unrepresentable.
- [`system-design`](../SKILLS.md#system-design) — untrusted input at a trust boundary.

## Open decisions

- **OD-BR-9** Minimum independent sources to publish.
- **OD-EV-1** Source authority grading (BR-EV-07) — feeds `evidence_quality`.
- **OD-EV-2** Behaviour on source retraction or 404 (BR-EV-08): withdraw the Signal, annotate it, or
  leave it.
- **OD-EV-3** Evidence retention (BR-EV-09).
- **OD-EV-4** Whether the pipeline re-checks source URLs on a schedule. Cost and integrity trade-off.
