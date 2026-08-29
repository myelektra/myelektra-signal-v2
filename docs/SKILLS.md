# Skill Index

## Purpose

Single resolution point for every skill referenced from a `Related skills` section in this
documentation set. Documents link here (e.g. `[clean-architecture](SKILLS.md#clean-architecture)`
from a document at the `docs/` root, or `../SKILLS.md#clean-architecture` from one directory deeper)
so that no document contains a dangling link to a file that does not exist in this repository.

## Scope

In scope: the named skill catalog, the status of each entry, and the rule for how documents cite
skills. Out of scope: the content of the skills themselves.

## Source of truth

The skill *names* come from the strategic brief. The skill *content* lived in `SKILLS.md` in the
legacy repository `myelektra-signal-saas`, which is **not present** in this workspace (see
[`00-product/forensic-audit.md`](00-product/forensic-audit.md)). Every entry below is therefore
listed as a **reference without content**, not as reproduced knowledge.

| Status | Meaning |
| --- | --- |
| `reference-only` | Named by the brief; content not available in this workspace. Cited for intent only. |

## Requirements

- `R-SK-1` Every document must cite skills by linking to an anchor in this file, never to a
  nonexistent path.
- `R-SK-2` No document may quote skill content as if it had been read. Where a document applies a
  skill, it must state the principle it is applying in its own words.
- `R-SK-3` If the legacy `SKILLS.md` is later supplied, each entry moves from `reference-only` to
  `available` with a link, and documents citing it may then be revised against it.

## Catalog

### Product and messaging

| Skill | Status | Referenced by |
| --- | --- | --- |
| <a id="storybrand-messaging"></a>`storybrand-messaging` | reference-only | [homepage](09-ui/homepage.md), [product-requirements](00-product/product-requirements.md) |
| <a id="made-to-stick"></a>`made-to-stick` | reference-only | [homepage](09-ui/homepage.md) |
| <a id="one-page-marketing"></a>`one-page-marketing` | reference-only | [homepage](09-ui/homepage.md) |
| <a id="obviously-awesome"></a>`obviously-awesome` | reference-only | [homepage](09-ui/homepage.md), [product-requirements](00-product/product-requirements.md) |

### Design and UX

| Skill | Status | Referenced by |
| --- | --- | --- |
| <a id="ux-heuristics"></a>`ux-heuristics` | reference-only | [customer-dashboard](09-ui/customer-dashboard.md), [admin-dashboard](09-ui/admin-dashboard.md) |
| <a id="refactoring-ui"></a>`refactoring-ui` | reference-only | all `09-ui/*` |
| <a id="design-everyday-things"></a>`design-everyday-things` | reference-only | all `09-ui/*` |
| <a id="web-typography"></a>`web-typography` | reference-only | all `09-ui/*` |

### Engineering craft

| Skill | Status | Referenced by |
| --- | --- | --- |
| <a id="clean-architecture"></a>`clean-architecture` | reference-only | [system-architecture](01-architecture/system-architecture.md), [backend](01-architecture/backend.md) |
| <a id="clean-code"></a>`clean-code` | reference-only | [backend](01-architecture/backend.md), [signal-model](04-signals/signal-model.md) |
| <a id="refactoring"></a>`refactoring` | reference-only | [backend](01-architecture/backend.md) |
| <a id="pragmatic-programmer"></a>`pragmatic-programmer` | reference-only | [test-strategy](10-testing/test-strategy.md), [migrations](02-database/migrations.md) |

### Systems and operations

| Skill | Status | Referenced by |
| --- | --- | --- |
| <a id="release-it"></a>`release-it` | reference-only | [deployment](01-architecture/deployment.md), [production-checklist](10-testing/production-checklist.md) |
| <a id="system-design"></a>`system-design` | reference-only | [system-architecture](01-architecture/system-architecture.md) |
| <a id="ddia-systems"></a>`ddia-systems` | reference-only | [job-lifecycle](06-jobs/job-lifecycle.md), [idempotency](06-jobs/idempotency.md) |

### Platform

| Skill | Status | Referenced by |
| --- | --- | --- |
| <a id="supabase"></a>`supabase` | reference-only | [backend](01-architecture/backend.md), [rls](02-database/rls.md), [cron](06-jobs/cron.md) |
| <a id="supabase-postgres-best-practices"></a>`supabase-postgres-best-practices` | reference-only | [schema](02-database/schema.md), [migrations](02-database/migrations.md), [rls](02-database/rls.md) |

## Security considerations

None directly. This file exists so that citations are auditable rather than fabricated.

## Acceptance criteria

- [ ] Every `Related skills` entry in `docs/**` resolves to an anchor in this file.
- [ ] No document claims to have read skill content.

## Open decisions

- **OD-SK-1** Will the legacy `SKILLS.md` be supplied? Until then all entries stay `reference-only`
  and skill application is judgement-based, not citation-based.
