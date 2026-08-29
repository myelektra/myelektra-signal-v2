#!/usr/bin/env python3
"""Documentation integrity check for myelektra-signal-v2.

Ported into the repository in Phase 1B so the gate is versioned and runnable by
anyone (foundation-plan R-FN-6). It previously lived outside the repository and
could not be reproduced from a clean checkout.

Verifies:
  * every mandated document is present;
  * each carries the eight required sections;
  * internal links and anchors resolve, including skill anchors;
  * provenance tagging is present;
  * no RLS policy is described with column granularity;
  * the schema document declares `amount_usd` with `currency = 'USD'` checks and
    prohibits floating-point money.

Currency naming and provider/currency *identifiers* are scanned by
`scripts/check-usd-only.py`, which derives them from
`docs/00-product/legacy-exclusion-list.md`. Keeping them in one place avoids two
lists drifting apart.

Exit code 0 means every check passed. Anything else is a defect, not a warning.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

# The 41 Phase 0 mandated documents plus the Phase 1A foundation plan.
REQUIRED = [
    "00-product/product-requirements.md",
    "00-product/business-rules.md",
    "00-product/glossary.md",
    "00-product/forensic-audit.md",
    "00-product/legacy-audit-gap-register.md",
    "00-product/assumptions.md",
    "00-product/currency-and-cost-policy.md",
    "00-product/legacy-exclusion-list.md",
    "00-product/open-decisions.md",
    "01-architecture/system-architecture.md",
    "01-architecture/frontend.md",
    "01-architecture/backend.md",
    "01-architecture/deployment.md",
    "01-architecture/foundation-plan.md",
    "02-database/schema.md",
    "02-database/rls.md",
    "02-database/tenant-isolation.md",
    "02-database/migrations.md",
    "03-auth/authentication-authorization.md",
    "04-signals/signal-model.md",
    "04-signals/evidence.md",
    "04-signals/validation.md",
    "04-signals/deduplication.md",
    "04-signals/scoring.md",
    "05-billing/paypal.md",
    "05-billing/pricing.md",
    "05-billing/subscriptions.md",
    "05-billing/entitlements.md",
    "05-billing/reconciliation.md",
    "06-jobs/cron.md",
    "06-jobs/job-lifecycle.md",
    "06-jobs/idempotency.md",
    "07-security/security-model.md",
    "07-security/threat-model.md",
    "07-security/secrets.md",
    "08-admin/admin-control-plane.md",
    "09-ui/homepage.md",
    "09-ui/customer-dashboard.md",
    "09-ui/admin-dashboard.md",
    "10-testing/test-strategy.md",
    "10-testing/rls-verification.md",
    "10-testing/production-checklist.md",
]

SECTIONS = [
    "Purpose",
    "Scope",
    "Source of truth",
    "Requirements",
    "Security considerations",
    "Acceptance criteria",
    "Related skills",
    "Open decisions",
]

# Index and skill registers are not requirement documents; they have no sections.
SKIP_SECTIONS = {"docs/README.md", "docs/SKILLS.md"}

LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")

# Monetary naming (`*_usd`, no stale `*_cents`) is a currency concern and is
# owned by scripts/check-usd-only.py. It is deliberately not repeated here: two
# copies of the same list is two places to fall out of sync.

# An RLS policy operates on rows. A policy qualified by a column is a modelling
# error: column protection is delivered by GRANT/REVOKE and triggers, not RLS
# (schema R-DB-6/R-DB-7, rls R-RL-4).
BAD_RLS = re.compile(r"(UPDATE|INSERT|DELETE)`? policy[^.\n]{0,60}`?[a-z_]+\.[a-z_*]+`?", re.I)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def strip_code(text: str) -> str:
    """Remove fenced and inline code so links inside examples are not checked."""
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    return re.sub(r"`[^`\n]*`", "", text)


def heading_slugs(body: str) -> set[str]:
    slugs = {
        re.sub(r"[^a-z0-9 \-]", "", h.lower()).strip().replace(" ", "-")
        for h in re.findall(r"^#{1,6}\s+(.+?)\s*$", body, re.M)
    }
    # Some links drop the trailing provenance tag or the requirement id.
    return slugs | {re.sub(r"[^a-z0-9\-]", "", s) for s in slugs}


def main() -> int:
    fails: list[str] = []
    warns: list[str] = []

    missing = [f for f in REQUIRED if not (DOCS / f).exists()]
    if missing:
        fails.append("MISSING MANDATED FILES: " + ", ".join(missing))

    all_md = sorted(DOCS.rglob("*.md"))

    # 1. Required sections -------------------------------------------------
    checked = 0
    for path in all_md:
        rel = path.relative_to(ROOT).as_posix()
        if rel in SKIP_SECTIONS:
            continue
        heads = set(re.findall(r"^##\s+(.+?)\s*$", read(path), re.M))
        normalised = {re.sub(r"\s*`.*$", "", h).strip() for h in heads}
        absent = [s for s in SECTIONS if not any(n == s or n.startswith(s) for n in normalised)]
        if absent:
            fails.append(f"{rel}: missing sections {absent}")
        checked += 1

    # 2. Links and anchors -------------------------------------------------
    links = 0
    for path in [*all_md, ROOT / "README.md"]:
        rel = path.relative_to(ROOT).as_posix()
        for target in LINK.findall(strip_code(read(path))):
            if target.startswith(("http://", "https://", "mailto:")):
                continue
            links += 1
            link_path, _, anchor = target.partition("#")
            resolved = (path.parent / link_path).resolve() if link_path else path
            if not resolved.exists():
                fails.append(f"{rel}: broken link -> {target}")
                continue
            if anchor and resolved.suffix == ".md":
                body = read(resolved)
                if f'id="{anchor}"' in body:
                    continue
                if anchor.lower() not in heading_slugs(body):
                    fails.append(f"{rel}: broken anchor -> {target}")

    # 3. Skill anchors -----------------------------------------------------
    skills_path = DOCS / "SKILLS.md"
    anchors: set[str] = set()
    if skills_path.exists():
        anchors = set(re.findall(r'<a id="([^"]+)">', read(skills_path)))
        for path in all_md:
            for target in LINK.findall(strip_code(read(path))):
                if "SKILLS.md#" in target and target.split("#", 1)[1] not in anchors:
                    fails.append(f"{path.relative_to(ROOT).as_posix()}: unresolved skill -> {target}")

    # 4. Provenance --------------------------------------------------------
    for path in all_md:
        rel = path.relative_to(ROOT).as_posix()
        if rel not in SKIP_SECTIONS and "`S1`" not in read(path):
            warns.append(f"{rel}: no `S1` provenance tag")

    # 5. RLS must not be described with column granularity -----------------
    for path in all_md:
        rel = path.relative_to(ROOT).as_posix()
        for line in read(path).split("\n"):
            if BAD_RLS.search(line):
                fails.append(f"{rel}: RLS policy described with column granularity: {line.strip()[:90]}")

    # 6. Schema must actually declare the money model ----------------------
    schema_path = DOCS / "02-database" / "schema.md"
    if not schema_path.exists():
        fails.append("docs/02-database/schema.md is missing")
    else:
        schema = read(schema_path)
        if "amount_usd" not in schema:
            fails.append("schema.md does not declare amount_usd")
        if schema.count("check (currency = 'USD')") < 3:
            fails.append("schema.md has fewer than 3 currency='USD' checks")
        for ftype in ("float", "double precision"):
            if f"`{ftype}`" in schema and "prohibited" not in schema:
                fails.append(f"schema.md mentions {ftype} without prohibiting it")

    # The "an excluded identifier must never be defined as a schema field" half
    # of the currency gate lives in scripts/check-usd-only.py, because that is
    # where the identifier list is derived from. Keeping it there means one list.

    print(f"[i] markdown files under docs/: {len(all_md)}")
    print(f"[i] mandated files present: {len(REQUIRED) - len(missing)}/{len(REQUIRED)}")
    print(f"[i] section-checked docs: {checked}")
    print(f"[i] internal links checked: {links}")
    print(f"[i] skill anchors defined: {len(anchors)}")
    print()

    if warns:
        print("WARNINGS:")
        for warn in warns:
            print("  -", warn)
        print()

    if fails:
        print(f"FAILED ({len(fails)}):")
        for fail in fails:
            print("  -", fail)
        return 1

    print("ALL DOC CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    sys.exit(main())
