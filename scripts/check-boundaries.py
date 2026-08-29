#!/usr/bin/env python3
"""Import and environment boundary gate for myelektra-signal-v2.

Implements the approved boundary of foundation-plan R-FN-2 as an executable
check. It is the third mechanism, after module resolution and ESLint, and the
only one that is both dependency-free and able to see dynamic imports.

Why three mechanisms for one rule: a boundary held by a single check gets
crossed. Module resolution blocks the obvious case (bun links only declared
dependencies, so `@myelektra/domain` is not resolvable from `apps/web` at all).
ESLint gives in-editor feedback. This script is the one that runs the same rules
over raw source, catches `await import(...)` and `require(...)`, and verifies
the structural invariants that no linter can — that the Deno import map points
at shared source, that no `_shared` copy exists, and that the browser
environment inventory matches `.env.example`.

The approved path is exactly:

    apps/web  ->  contracts  ->  apps/web/src/api  ->  Supabase Auth / Edge Function

This script invents no business rule. It only knows which module may reach
which.

Exit code 0 means every rule held. Exit code 1 lists every violation found.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

WEB = ROOT / "apps" / "web"
WEB_API = WEB / "src" / "api"
WEB_CLIENT = WEB_API / "client.ts"
PACKAGES = ROOT / "packages"
FUNCTIONS = ROOT / "supabase" / "functions"
DENO_CONFIG = ROOT / "supabase" / "deno.json"
ENV_EXAMPLE = ROOT / ".env.example"

DOMAIN_SPEC = "@myelektra/domain"
CONTRACTS_SPEC = "@myelektra/contracts"
ADAPTERS_SPEC = "@myelektra/adapters"
SUPABASE_JS = "@supabase/supabase-js"
PAYPAL_BROWSER_SDK = {"@paypal/paypal-js", "@paypal/react-paypal-js"}

# The only module in apps/web permitted to construct a Supabase client. Keeping
# it to one file is what makes "the SPA holds no privileged client" auditable
# without reviewing every component.
SUPABASE_JS_ALLOWED = "apps/web/src/api/client.ts"

PROVIDER_SDKS = {
    "@paypal/checkout-server-sdk",
    "@paypal/paypal-server-sdk",
    "openai",
    "@openai/openai",
    "@anthropic-ai/sdk",
    "algoliasearch",
    "serpapi",
    "resend",
    "@sendgrid/mail",
    "nodemailer",
    "postmark",
}

SERVER_DATA_ACCESS = {"@supabase/ssr", "postgres", "pg", "@supabase/postgres-meta"}

# Browser-safe third-party specifiers permitted under apps/web/src.
WEB_BARE_ALLOWED = {"react", "react-dom", CONTRACTS_SPEC}
WEB_BARE_PREFIXES = ("react/", "react-dom/", "@types/")

# vite.config.ts is tooling, not shipped code.
WEB_TOOLING_ALLOWED = {"vite", "@vitejs/plugin-react"}

# The server-only Supabase role name. It may be written down in exactly one
# place — the module that exists to reject it.
SERVER_ONLY_ROLE_LITERAL = "service_role"

SOURCE_SUFFIXES = {".ts", ".tsx", ".mts", ".cts"}

FROM_IMPORT = re.compile(r"""\bfrom\s*["']([^"']+)["']""")
BARE_IMPORT = re.compile(r"""\bimport\s*["']([^"']+)["']""")
DYNAMIC_IMPORT = re.compile(r"""\bimport\s*\(\s*["']([^"']+)["']\s*\)""")
REQUIRE_CALL = re.compile(r"""\brequire\s*\(\s*["']([^"']+)["']\s*\)""")

# Documented browser variables (foundation-plan R-FN-3, secrets R-SE-1).
DOCUMENTED_BROWSER_ENV = {
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_PAYPAL_CLIENT_ID",
    "VITE_PAYPAL_ENV",
}


class Report:
    def __init__(self) -> None:
        self.fails: list[str] = []
        self.notes: list[str] = []

    def fail(self, message: str) -> None:
        self.fails.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)


def strip_comments(source: str) -> str:
    """Remove comments so prose about an import is not read as an import.

    `://` is preserved so URLs inside string literals survive.
    """
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    source = re.sub(r"(?<!:)//[^\n]*", "", source)
    return source


def specifiers_in(path: Path) -> list[str]:
    """Every import/export/dynamic-import/require specifier in a source file."""
    body = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
    found: list[str] = []
    for pattern in (FROM_IMPORT, BARE_IMPORT, DYNAMIC_IMPORT, REQUIRE_CALL):
        found.extend(pattern.findall(body))
    # Deduplicate, preserving order.
    return list(dict.fromkeys(found))


def source_files(*roots: Path) -> list[Path]:
    files: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix in SOURCE_SUFFIXES:
                if not any(part in {"node_modules", "dist", ".temp"} for part in path.parts):
                    files.append(path)
    return sorted(files)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def is_relative(spec: str) -> bool:
    return spec.startswith("./") or spec.startswith("../") or spec == "." or spec == ".."


def is_runtime_url(spec: str) -> bool:
    """Deno remote and prefixed specifiers, which are not workspace modules."""
    return spec.startswith(("jsr:", "npm:", "node:", "https://", "http://", "file:"))


def is_style(spec: str) -> bool:
    return spec.endswith((".css", ".scss", ".svg", ".png"))


def base_package(spec: str) -> str:
    """`@scope/pkg/sub` -> `@scope/pkg`; `pkg/sub` -> `pkg`."""
    if spec.startswith("@"):
        head, _, tail = spec.partition("/")
        return f"{head}/{tail.split('/')[0]}" if tail else head
    return spec.split("/")[0]


# --- Rule 1: apps/web ------------------------------------------------------


def check_web(report: Report) -> None:
    files = source_files(WEB / "src") + ([WEB / "vite.config.ts"] if (WEB / "vite.config.ts").exists() else [])
    if not files:
        report.fail("apps/web contains no source files")
        return

    client_seen = False
    for path in files:
        where = rel(path)
        in_api = path.parent == WEB_API or str(path.parent).startswith(f"{WEB_API.as_posix()}/")
        is_client = path.resolve() == WEB_CLIENT.resolve()
        is_tooling = path.name == "vite.config.ts"
        is_test = path.name.endswith((".test.ts", ".test.tsx"))

        if is_client:
            client_seen = True

        for spec in specifiers_in(path):
            pkg = base_package(spec)

            # The test runner is not a shipped dependency.
            if spec == "bun:test":
                if is_test:
                    continue
                report.fail(f"{where} imports bun:test outside a test file")
                continue

            # Never importable from anywhere in apps/web.
            if pkg in (DOMAIN_SPEC, ADAPTERS_SPEC):
                report.fail(
                    f"{where} imports {spec}: apps/web must not import the domain or "
                    "adapters packages (R-FN-2)"
                )
                continue
            if pkg in PROVIDER_SDKS or pkg in SERVER_DATA_ACCESS:
                report.fail(f"{where} imports {spec}: server-only provider or data access (R-FN-2)")
                continue

            # Relative imports must stay inside apps/web.
            if is_relative(spec):
                target = (path.parent / spec).resolve()
                if not str(target).startswith(WEB.resolve().as_posix()):
                    report.fail(f"{where} reaches outside apps/web via {spec} (R-FN-2)")
                continue

            if is_style(spec):
                continue

            # @supabase/supabase-js: one module only.
            if pkg == SUPABASE_JS:
                if not is_client:
                    report.fail(
                        f"{where} imports {SUPABASE_JS}: it may be imported only from "
                        f"{SUPABASE_JS_ALLOWED} (R-FN-2)"
                    )
                continue

            # PayPal browser SDK: inside the API boundary only.
            if pkg in PAYPAL_BROWSER_SDK:
                if not in_api:
                    report.fail(
                        f"{where} imports {spec}: the PayPal browser SDK may be loaded "
                        "only inside apps/web/src/api (R-FN-2)"
                    )
                continue

            if is_tooling:
                if pkg in WEB_TOOLING_ALLOWED:
                    continue
                report.fail(f"{where} imports {spec}: not part of the frontend toolchain")
                continue

            # Everything else must be on the browser-safe allow list.
            if pkg in WEB_BARE_ALLOWED or pkg.startswith(WEB_BARE_PREFIXES):
                continue

            report.fail(
                f"{where} imports {spec}: outside apps/web/src/api, import "
                f"{CONTRACTS_SPEC} or ./api only (R-FN-2)"
            )

    if not client_seen:
        report.fail(
            f"{SUPABASE_JS_ALLOWED} is missing: the API boundary has no client module"
        )

    # No server-only credential name anywhere except the module that rejects it.
    # That module's own test is exempt for the same reason it is not shipped:
    # Vite bundles only what is reachable from the entry point, so a test file
    # never reaches the browser. The credential scan over apps/web/dist is the
    # compensating control.
    for path in source_files(WEB):
        where = rel(path)
        if path.resolve() == WEB_CLIENT.resolve():
            continue
        if path.name == "client.test.ts":
            continue
        body = path.read_text(encoding="utf-8", errors="replace")
        if re.search(SERVER_ONLY_ROLE_LITERAL, body, re.I):
            report.fail(
                f"{where} references a server-only Supabase credential; that name may "
                f"appear only in {SUPABASE_JS_ALLOWED} (R-FN-2)"
            )
        if "process.env" in body:
            report.fail(
                f"{where} reads process.env: the browser has no process. Read "
                "import.meta.env through apps/web/src/api (R-FN-3)"
            )


# --- Rule 2: packages ------------------------------------------------------


def check_packages(report: Report) -> None:
    for name, allowed_workspace, label in (
        ("domain", set(), "the pure core: no I/O, no database client, no provider SDK, no React"),
        ("contracts", set(), "browser-safe and self-contained: no provider SDK, no database types"),
        ("adapters", {DOMAIN_SPEC, CONTRACTS_SPEC}, "may use domain and contracts"),
    ):
        src = PACKAGES / name / "src"
        for path in source_files(src):
            where = rel(path)
            is_test = path.name.endswith(".test.ts")
            for spec in specifiers_in(path):
                if is_relative(spec):
                    target = (path.parent / spec).resolve()
                    if not str(target).startswith((PACKAGES / name).resolve().as_posix()):
                        report.fail(f"{where} reaches outside packages/{name} via {spec}")
                    continue
                if spec == "bun:test":
                    if is_test:
                        continue
                    report.fail(f"{where} imports bun:test outside a test file")
                    continue
                pkg = base_package(spec)
                if pkg in allowed_workspace:
                    continue
                if name == "adapters":
                    if pkg in {"react", "react-dom", "vite", "@vitejs/plugin-react"}:
                        report.fail(f"{where} imports {spec}: adapters are server-side")
                        continue
                    if pkg in {"apps", "@myelektra/web"}:
                        report.fail(f"{where} imports {spec}: adapters must not import apps (R-SA-3)")
                        continue
                    # Adapters may take a server-side provider dependency later;
                    # that is a Phase 7 decision, not a boundary violation.
                    report.note(f"{where} imports {spec}: server-side dependency")
                    continue
                report.fail(f"{where} imports {spec}: {label}")


# --- Rule 3: supabase/functions -------------------------------------------


def check_functions(report: Report) -> None:
    if not FUNCTIONS.exists():
        report.fail("supabase/functions is missing")
        return

    shared = FUNCTIONS / "_shared"
    if shared.exists():
        report.fail(
            "supabase/functions/_shared exists. Strategy A (R-FN-12) maps the import "
            "map at shared source; a copy creates a second source of truth. The "
            "fallback (R-FN-14) requires it to be generated and git-ignored."
        )

    functions = source_files(FUNCTIONS)
    if not functions:
        report.fail("supabase/functions contains no entrypoint")
        return

    for path in functions:
        where = rel(path)
        for spec in specifiers_in(path):
            if is_runtime_url(spec):
                continue
            if is_relative(spec):
                target = (path.parent / spec).resolve()
                if str(target).startswith((ROOT / "apps").resolve().as_posix()):
                    report.fail(f"{where} imports apps/ code: dependency direction is one-way (R-SA-3)")
                continue
            pkg = base_package(spec)
            if pkg in (DOMAIN_SPEC, CONTRACTS_SPEC, ADAPTERS_SPEC):
                continue
            if pkg.startswith("@myelektra/"):
                report.fail(f"{where} imports {spec}: not an Edge Function dependency")
                continue
            report.note(f"{where} imports {spec}: external runtime dependency")


# --- Rule 4: Deno import map ----------------------------------------------


def check_deno_config(report: Report) -> None:
    if not DENO_CONFIG.exists():
        report.fail("supabase/deno.json is missing: Edge Functions cannot resolve shared packages")
        return

    raw = DENO_CONFIG.read_text(encoding="utf-8")
    # The file carries explanatory comments, so it is JSONC.
    config = json.loads(re.sub(r"^\s*//.*$", "", raw, flags=re.M))
    imports = config.get("imports", {})

    expected = {
        DOMAIN_SPEC: "../packages/domain/src/index.ts",
        CONTRACTS_SPEC: "../packages/contracts/src/index.ts",
    }
    for spec, target in expected.items():
        if imports.get(spec) != target:
            report.fail(
                f"supabase/deno.json must map {spec} to {target} (R-FN-12); found "
                f"{imports.get(spec)!r}"
            )

    for spec, target in imports.items():
        resolved = (DENO_CONFIG.parent / target).resolve()
        if not resolved.exists():
            report.fail(f"supabase/deno.json maps {spec} to {target}, which does not exist")
        elif not str(resolved).startswith(PACKAGES.resolve().as_posix()):
            report.fail(
                f"supabase/deno.json maps {spec} outside packages/: shared source must "
                "have exactly one home (R-FN-12)"
            )


# --- Rule 5: workspace dependency declarations ----------------------------


def check_workspace_manifests(report: Report) -> None:
    manifest = WEB / "package.json"
    if not manifest.exists():
        report.fail("apps/web/package.json is missing")
        return
    declared = json.loads(manifest.read_text(encoding="utf-8"))
    for field in ("dependencies", "devDependencies", "peerDependencies"):
        for dep in declared.get(field, {}):
            if dep in (DOMAIN_SPEC, ADAPTERS_SPEC):
                report.fail(
                    f"apps/web/package.json declares {dep} in {field}: apps/web must not "
                    "depend on it, and declaring it would make it resolvable (R-FN-2)"
                )


# --- Rule 6: browser/server environment boundary --------------------------


def check_env_boundary(report: Report) -> None:
    if (ROOT / ".env").exists():
        report.fail(".env exists in the working tree; it must never be committed")

    if not ENV_EXAMPLE.exists():
        report.fail(".env.example is missing")
        return

    defined: set[str] = set()
    for line in ENV_EXAMPLE.read_text(encoding="utf-8").split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, _, value = stripped.partition("=")
        name = name.strip()
        defined.add(name)
        if name.startswith("VITE_") and "SECRET" in name.upper():
            report.fail(f".env.example exposes a secret to the browser: {name}")
        if value.strip():
            report.fail(f".env.example must leave {name} empty; a committed value is a defect")

    if defined != DOCUMENTED_BROWSER_ENV and not defined.issuperset(DOCUMENTED_BROWSER_ENV):
        missing = sorted(DOCUMENTED_BROWSER_ENV - defined)
        report.fail(f".env.example is missing documented browser variables: {missing}")

    undocumented = sorted(n for n in defined if n.startswith("VITE_") and n not in DOCUMENTED_BROWSER_ENV)
    if undocumented:
        report.fail(
            f".env.example declares VITE_ variables that are not in the documented "
            f"inventory (R-FN-3): {undocumented}. Adding one makes a value public."
        )

    # Every VITE_ variable read in source must be documented.
    for path in source_files(WEB):
        where = rel(path)
        body = path.read_text(encoding="utf-8", errors="replace")
        for name in set(re.findall(r"\bVITE_[A-Z0-9_]+", body)):
            if name not in DOCUMENTED_BROWSER_ENV:
                report.fail(f"{where} reads {name}, which is not in the documented inventory")


def main() -> int:
    report = Report()

    checks = (
        ("apps/web import boundary", check_web),
        ("packages layering", check_packages),
        ("supabase/functions imports", check_functions),
        ("Deno import map (strategy A)", check_deno_config),
        ("workspace dependency declarations", check_workspace_manifests),
        ("browser/server environment boundary", check_env_boundary),
    )

    print("[i] boundary rules checked:")
    for label, fn in checks:
        print(f"      - {label}")
        fn(report)
    print()

    for note in report.notes:
        print("[i]", note)
    if report.notes:
        print()

    if report.fails:
        print(f"BOUNDARY VIOLATIONS ({len(report.fails)}):")
        for fail in report.fails:
            print("  -", fail)
        return 1

    scanned = len(source_files(WEB, PACKAGES, FUNCTIONS))
    print(f"[i] source files inspected: {scanned}")
    print("ALL BOUNDARY CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
