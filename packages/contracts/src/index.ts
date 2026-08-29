/**
 * `@myelektra/contracts` — transport shapes shared by `apps/web` and
 * `supabase/functions`.
 *
 * This is the *only* workspace package `apps/web` may import
 * (foundation-plan R-FN-2). Everything in it must therefore be safe to inline
 * into a browser bundle: no provider SDK types, no database row types, no
 * service-role references, no secrets.
 *
 * It imports nothing outside itself, so the dependency direction
 * `apps/web -> contracts` and `supabase/functions -> contracts` stays acyclic.
 *
 * **Phase 1B status: placeholder.** Only transport-level shapes are declared.
 * Request and response types for signals, payments, subscriptions, and access
 * state are deliberately absent until their domain decisions are approved.
 */

/** Package identity. Read at runtime by the Deno import-boundary spike. */
export const CONTRACTS_PACKAGE = "@myelektra/contracts" as const;

/** Package version, kept in sync with `package.json` by hand for now. */
export const CONTRACTS_VERSION = "0.0.0" as const;

/**
 * Version of the HTTP contract. Bumped when a shape changes incompatibly, so a
 * stale browser bundle can be detected instead of silently misparsing.
 */
export const API_SCHEMA_VERSION = "0" as const;

/** Error codes that are transport-level rather than business-level. */
export const TRANSPORT_ERROR_CODES = [
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "internal_error",
] as const;

export type TransportErrorCode = (typeof TRANSPORT_ERROR_CODES)[number];

/**
 * The error envelope every Edge Function returns. Deliberately carries no
 * domain detail: business error codes arrive with the domain decisions, not
 * before them.
 */
export interface ApiErrorEnvelope {
  readonly error: {
    readonly code: TransportErrorCode;
    readonly message: string;
    readonly schemaVersion: typeof API_SCHEMA_VERSION;
  };
}

/** Path of the import-boundary spike function (`supabase/functions/spike`). */
export const SPIKE_PATH = "/spike" as const;

/**
 * Response of the import-boundary spike function. It exists to prove that an
 * Edge Function resolves `@myelektra/domain` and `@myelektra/contracts` through
 * `supabase/deno.json` at *runtime*, not only at typecheck time
 * (foundation-plan R-FN-12). It is not a product endpoint.
 */
export interface SpikeResponse {
  readonly path: typeof SPIKE_PATH;
  readonly ok: true;
  readonly domain: string;
  readonly contracts: string;
  readonly predicate: boolean;
}
