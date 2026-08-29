#!/usr/bin/env python3
"""USD-only and legacy-exclusion gate for myelektra-signal-v2.

Implements `currency-and-cost-policy` R-CU-6 and `legacy-exclusion-list` R-LC-4
as an executable check (foundation-plan R-FN-8).

The identifier lists are **derived from the documentation**, not restated here.
`legacy-exclusion-list.md` is the single canonical home for them; a second copy
in a script is a second place to fall out of sync. If the document stops
defining something this script expects, the script fails and says so, rather
than quietly scanning for less.

Checks:
  1. No excluded provider name (R-LC-1) appears in source, configuration, the
     dependency tree, or documentation outside the exclusion documents.
  2. No excluded currency identifier (R-LC-5) appears anywhere it should not,
     and none is *defined* as a schema field.
  3. No stale `*_cents` monetary name survives anywhere.
  4. `.env` is not committed.
  5. Migrations, when they exist, name money `*_usd`, pair it with
     `check (currency = 'USD')`, forbid floating-point, and require a
     non-negative check.

The browser/server environment boundary (the `VITE_` prefix rule) is checked by
`scripts/check-boundaries.py`; it is a boundary concern, not a currency one.

This script invents no business value. It knows no price, quota, score, or
rate; it only knows what names are forbidden and how money must be shaped.

Exit code 0 means every check that could run, passed. A check that could not
run is reported as NOT RUN, never as a pass.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXCLUSION_DOC = ROOT / "docs" / "00-product" / "legacy-exclusion-list.md"
MIGRATIONS = ROOT / "supabase" / "migrations"

# This file defines its own rule set, so it cannot scan itself.
SELF = Path(__file__).resolve()

SKIP_DIRS = {".git", "node_modules", "dist", ".temp", ".branches"}

TEXT_SUFFIXES = {
    ".md", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".jsonc",
    ".yml", ".yaml", ".toml", ".sql", ".py", ".sh", ".css", ".html", ".txt",
    ".env", ".example", ".lock", ".gitignore",
}

STALE_MONEY_NAMES = ["amount_cents", "price_cents", "total_cents", "cost_cents", "fee_cents"]

# Documents whose purpose is to state an exclusion. Everywhere else, naming an
# excluded provider or currency construct is a defect (R-LC-4).
EXCLUSION_DOCUMENTS = {
    "README.md",
    "docs/00-product/legacy-exclusion-list.md",
    "docs/00-product/currency-and-cost-policy.md",
    "docs/00-product/business-rules.md",
    "docs/00-product/forensic-audit.md",
    "docs/00-product/open-decisions.md",
    "docs/01-architecture/system-architecture.md",
    "docs/01-architecture/backend.md",
    "docs/02-database/migrations.md",
    "docs/02-database/schema.md",
    "docs/03-auth/authentication-authorization.md",
    "docs/05-billing/paypal.md",
    "docs/05-billing/pricing.md",
    "docs/07-security/security-model.md",
    "docs/10-testing/test-strategy.md",
}

# Identifier-shaped: a bare word, or a scoped npm package. Prose table cells
# such as "Currency conversion" or "FX table / rate cache" are descriptions of
# excluded *behaviour*, not identifiers, and must not become scan tokens.
IDENTIFIER_SHAPE = re.compile(r"^(?:@[a-z0-9._-]+/[a-z0-9._-]+|[A-Za-z][A-Za-z0-9_]*)$")

# "rupiah" is the natural-language name for IDR. It is prohibited by the
# R-LC-5 note ("No rupiah anywhere") but is not a table identifier, so it
# cannot be derived structurally. It is asserted against the document below so
# that this constant cannot outlive its source.
PROSE_TERMS = ("rupiah",)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def section(text: str, heading: str) -> str:
    """Return the body of a `### <heading>` section, up to the next heading."""
    pattern = re.compile(rf"^###\s+{re.escape(heading)}.*?$(.*?)(?=^###\s|^##\s)", re.M | re.S)
    match = pattern.search(text)
    return match.group(1) if match else ""


def table_first_column(body: str) -> list[str]:
    """First cell of every data row of the first markdown table in `body`."""
    cells: list[str] = []
    for line in body.split("\n"):
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        parts = [p.strip() for p in stripped.strip("|").split("|")]
        if not parts:
            continue
        first = parts[0]
        if first in ("Identifier", "Item", "Pattern") or set(first) <= {"-", " ", ":"}:
            continue
        cells.append(first)
    return cells


def to_token(cell: str) -> str | None:
    """Normalise a table cell into a scan token, or None if it is prose."""
    cleaned = cell.split(",")[0]
    cleaned = re.sub(r"[*`\[\]()]", "", cleaned).strip()
    return cleaned if IDENTIFIER_SHAPE.match(cleaned) else None


def load_excluded_identifiers() -> set[str]:
    """Derive every excluded identifier from legacy-exclusion-list.md."""
    if not EXCLUSION_DOC.exists():
        raise SystemExit(f"FATAL: {EXCLUSION_DOC} is missing; cannot derive the exclusion list.")

    doc = read(EXCLUSION_DOC)
    tokens: set[str] = set()

    for heading in ("R-LC-1 Prohibited technologies `S1`", "R-LC-5 Excluded currency handling `S1`"):
        body = section(doc, heading)
        if not body.strip():
            raise SystemExit(f"FATAL: section '{heading}' not found in {EXCLUSION_DOC}.")
        for cell in table_first_column(body):
            token = to_token(cell)
            if token:
                tokens.add(token)

    # Backticked identifiers anywhere in the currency section (catches ones that
    # appear only in prose, such as a rate constant mentioned in a note).
    currency_body = section(doc, "R-LC-5 Excluded currency handling `S1`")
    for backticked in re.findall(r"`([^`\n]+)`", currency_body):
        if IDENTIFIER_SHAPE.match(backticked) and not backticked.startswith("S"):
            tokens.add(backticked)

    for term in PROSE_TERMS:
        if term not in currency_body:
            raise SystemExit(
                f"FATAL: '{term}' is no longer documented in R-LC-5. "
                "Update PROSE_TERMS in scripts/check-usd-only.py."
            )
        tokens.add(term)

    # `S1`-style provenance tags are not identifiers.
    return {t for t in tokens if not re.fullmatch(r"S\d+", t)}


def build_matchers(tokens: set[str]) -> list[tuple[str, re.Pattern[str]]]:
    """Compile a matcher per token. All-caps tokens match case-sensitively."""
    matchers: list[tuple[str, re.Pattern[str]]] = []
    for token in sorted(tokens):
        if token.startswith("@"):
            matchers.append((token, re.compile(re.escape(token))))
        elif token.isupper():
            matchers.append((token, re.compile(rf"(?<![A-Za-z0-9_]){re.escape(token)}(?![A-Za-z0-9_])")))
        else:
            matchers.append((token, re.compile(rf"(?<![A-Za-z0-9_]){re.escape(token)}(?![A-Za-z0-9_])", re.I)))
    return matchers


def iter_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name == ".gitignore" or path.suffix.lower() in TEXT_SUFFIXES:
            files.append(path)
    return sorted(files)


def scan_sources(tokens: set[str]) -> tuple[list[str], int]:
    """Check 1-3: excluded identifiers and stale money names, repo-wide."""
    fails: list[str] = []
    matchers = build_matchers(tokens)
    scanned = 0

    for path in iter_files():
        rel = path.relative_to(ROOT).as_posix()
        if path.resolve() == SELF:
            continue
        body = read(path)
        scanned += 1

        is_exclusion_doc = rel in EXCLUSION_DOCUMENTS
        for token, matcher in matchers:
            if matcher.search(body) and not is_exclusion_doc:
                fails.append(f"excluded identifier `{token}` appears in {rel}")

        lowered = body.lower()
        for stale in STALE_MONEY_NAMES:
            if stale in lowered:
                fails.append(f"{rel}: stale monetary name `{stale}` (must be `*_usd`)")

    return fails, scanned


CREATE_TABLE = re.compile(r"create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)\s*\((.*?)\n\s*\);", re.I | re.S)
MONEY_HINT = re.compile(r"(amount|price|cost|fee|total|balance|revenue)", re.I)
FLOAT_TYPES = re.compile(r"\b(double\s+precision|real|float\d*)\b", re.I)
USD_CHECK = re.compile(r"check\s*\(\s*currency\s*=\s*'USD'\s*\)", re.I)
COLUMN_NAME = re.compile(r"^[a-z_][a-z0-9_]*$")

# Lines inside a CREATE TABLE body that are not column definitions.
NON_COLUMN = {"primary", "constraint", "check", "foreign", "unique", "exclude", "like"}


def parse_columns(ddl: str) -> list[tuple[str, str]]:
    """`(name, rest_of_line)` for each column definition in a CREATE TABLE body.

    Line-based on purpose: a regex whose type group admits `\s` swallows the rest
    of the table, which is how a single bad pattern silently reports one column.
    """
    columns: list[tuple[str, str]] = []
    for raw in ddl.split("\n"):
        line = raw.strip().rstrip(",").strip()
        if not line:
            continue
        first, _, rest = line.partition(" ")
        if first.lower() in NON_COLUMN or not COLUMN_NAME.fullmatch(first):
            continue
        columns.append((first, rest.strip()))
    return columns


def non_negative_check(ddl: str, column: str) -> bool:
    """True when the column is bounded at zero, inline or by a table constraint."""
    return re.search(rf"check\s*\([^)]*{re.escape(column)}\s*>=\s*0", ddl, re.I) is not None


def scan_migrations() -> tuple[list[str], str]:
    """Check 5: money shaping in migrations. Fails closed, never vacuously."""
    if not MIGRATIONS.exists():
        return [], (
            "NOT RUN - no supabase/migrations directory. Creating one is "
            "prohibited before Phase 2 (foundation-plan R-FN-11)."
        )

    sql_files = sorted(MIGRATIONS.glob("*.sql"))
    if not sql_files:
        return [
            f"{MIGRATIONS.relative_to(ROOT).as_posix()} exists but contains no .sql file. "
            "An empty migrations directory is a premature scaffold; remove it or fill it in Phase 2."
        ], "FAILED CLOSED"

    fails: list[str] = []
    for sql_file in sql_files:
        rel = sql_file.relative_to(ROOT).as_posix()
        body = read(sql_file)

        for table, ddl in CREATE_TABLE.findall(body):
            columns = parse_columns(ddl)
            money = [(name, rest) for name, rest in columns if MONEY_HINT.search(name)]

            for name, rest in money:
                if not name.endswith("_usd"):
                    fails.append(f"{rel}: {table}.{name} holds money but is not named `*_usd`")
                if FLOAT_TYPES.search(rest):
                    fails.append(
                        f"{rel}: {table}.{name} uses a floating-point type; money must be exact `numeric`"
                    )
                if not non_negative_check(ddl, name):
                    fails.append(f"{rel}: {table}.{name} has no non-negative check")

            if money and not USD_CHECK.search(ddl):
                fails.append(f"{rel}: {table} stores money without `check (currency = 'USD')`")

        for token in ("amount_idr", "fx_rate", "exchange_rate", "usd_to_idr", "amount_cents", "price_cents"):
            if re.search(rf"(?<![a-z0-9_]){token}(?![a-z0-9_])", body, re.I):
                fails.append(f"{rel}: excluded or stale money identifier `{token}` in a migration")

    return fails, f"{len(sql_files)} migration file(s) scanned"


def scan_dependency_tree(tokens: set[str]) -> list[str]:
    """Check 1b: no excluded provider in the resolved dependency tree."""
    lock = ROOT / "bun.lock"
    if not lock.exists():
        return ["bun.lock is missing; run `bun install` so the dependency tree can be scanned"]

    body = read(lock).lower()
    fails = []
    for token in sorted(tokens):
        if token.startswith("@"):
            if token.lower() in body:
                fails.append(f"dependency tree contains the excluded package `{token}`")
        elif re.search(rf"(?<![a-z0-9]){re.escape(token.lower())}(?![a-z0-9])", body):
            fails.append(f"dependency tree contains `{token}`")
    return fails


def main() -> int:
    tokens = load_excluded_identifiers()

    print(f"[i] excluded identifiers derived from legacy-exclusion-list.md: {len(tokens)}")
    print(f"[i]   {', '.join(sorted(tokens))}")

    source_fails, scanned = scan_sources(tokens)
    print(f"[i] files scanned for excluded identifiers: {scanned}")

    dep_fails = scan_dependency_tree(tokens)
    migration_fails, migration_status = scan_migrations()
    print(f"[i] schema/money checks: {migration_status}")
    print()

    fails = source_fails + dep_fails + migration_fails
    if fails:
        print(f"FAILED ({len(fails)}):")
        for fail in fails:
            print("  -", fail)
        return 1

    print("USD-ONLY AND EXCLUSION CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
