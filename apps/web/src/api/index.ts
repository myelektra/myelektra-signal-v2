/**
 * The API surface. Every module in `apps/web` outside `src/api/` imports from
 * here and from `@myelektra/contracts`, and from nothing else
 * (foundation-plan R-FN-2).
 *
 * Note what is *not* exported: the Supabase client itself. It stays inside
 * `src/api/`, so the raw client cannot spread through the component tree and the
 * single-module restriction on `@supabase/supabase-js` stays meaningful. Once a
 * real endpoint exists, it is added here as a function — not as a client.
 *
 * Nothing in this module performs a network call. `describeApiBoundary` reports
 * local configuration only; it makes no claim about connectivity.
 */
export { API_SCHEMA_VERSION, CONTRACTS_PACKAGE, CONTRACTS_VERSION } from "@myelektra/contracts";

import { CONTRACTS_PACKAGE, CONTRACTS_VERSION, API_SCHEMA_VERSION } from "@myelektra/contracts";

import { isSupabaseConfigured } from "./client";
import {
  BROWSER_ENV_KEYS,
  DEFERRED_BROWSER_ENV_KEYS,
  REQUIRED_BROWSER_ENV_KEYS,
  readBrowserEnv,
  type EnvIssue,
} from "./env";

export { ApiBoundaryError } from "./client";
export {
  BROWSER_ENV_KEYS,
  DEFERRED_BROWSER_ENV_KEYS,
  PAYPAL_ENVIRONMENTS,
  REQUIRED_BROWSER_ENV_KEYS,
  readBrowserEnv,
  type BrowserEnv,
  type BrowserEnvKey,
  type EnvIssue,
  type PaypalEnvironment,
} from "./env";

/** Local configuration status of the API boundary. */
export interface ApiBoundaryStatus {
  readonly contractsPackage: string;
  readonly contractsVersion: string;
  readonly schemaVersion: string;
  readonly supabaseConfigured: boolean;
  readonly configuredKeys: readonly string[];
  readonly missingRequiredKeys: readonly string[];
  readonly deferredKeys: readonly string[];
  readonly issues: readonly EnvIssue[];
}

/**
 * Describes whether the SPA is wired to a backend. Reports configuration only —
 * no request is made, so a green result never means "the backend responded".
 */
export function describeApiBoundary(): ApiBoundaryStatus {
  const env = readBrowserEnv();
  const configured = Object.keys(env.values).sort();
  const missingRequired = REQUIRED_BROWSER_ENV_KEYS.filter((key) => env.values[key] === undefined);

  return {
    contractsPackage: CONTRACTS_PACKAGE,
    contractsVersion: CONTRACTS_VERSION,
    schemaVersion: API_SCHEMA_VERSION,
    supabaseConfigured: isSupabaseConfigured(),
    configuredKeys: configured,
    missingRequiredKeys: missingRequired,
    deferredKeys: DEFERRED_BROWSER_ENV_KEYS.filter((key) => env.values[key] === undefined),
    issues: env.issues,
  };
}

/** Every browser-readable variable name, for display and for the env check. */
export const BOUNDARY_ENV_KEYS: readonly string[] = BROWSER_ENV_KEYS;
