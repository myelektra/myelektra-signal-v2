/**
 * `@myelektra/domain` — Layer 1, the pure domain core.
 *
 * Layering rule (system-architecture R-SA-3): this package imports nothing
 * outside itself. No I/O, no database client, no provider SDK, no React.
 * Enforced by ESLint and by `scripts/check-boundaries.py`.
 *
 * **Phase 1B status: placeholder.** There are no business rules here yet, on
 * purpose. Scoring weights and bands, package quotas, deduplication semantics,
 * and payment lifecycle rules are either fixed by the brief in
 * `docs/00-product/business-rules.md` or blocked in
 * `docs/00-product/legacy-audit-gap-register.md` (B-2, B-3, B-4). Nothing from
 * a blocked decision may be invented here.
 *
 * Consumed by `supabase/functions` through the `supabase/deno.json` import map
 * (foundation-plan R-FN-12, strategy A) and by `packages/adapters`. Never by
 * `apps/web` — business rules must not ship to the browser.
 */

/** Package identity. Read at runtime by the Deno import-boundary spike. */
export const DOMAIN_PACKAGE = "@myelektra/domain" as const;

/** Package version, kept in sync with `package.json` by hand for now. */
export const DOMAIN_VERSION = "0.0.0" as const;

/**
 * Pure predicate. Exists so the Deno spike can prove that a *call*, not merely
 * a type, crosses the package boundary at runtime.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
