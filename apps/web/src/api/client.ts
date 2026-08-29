/**
 * The ONLY module in `apps/web` permitted to import `@supabase/supabase-js`.
 *
 * Approved request path (foundation-plan R-FN-2):
 *
 *   apps/web  ->  contracts  ->  apps/web/src/api  ->  Supabase Auth / Edge Function
 *
 * Every other module in `apps/web` imports from `./api`, never from here and
 * never from a client library directly. The single-module restriction is what
 * makes "the SPA holds no privileged client" auditable in one file instead of
 * requiring a review of every component.
 *
 * The anon key is not a privileged credential: every query made through this
 * client is subject to RLS (`docs/02-database/rls.md`). What is *not* available
 * from here is a write path to a protected column — those go through server-only
 * RPCs and Edge Functions (schema R-DB-7).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readBrowserEnv, type BrowserEnv } from "./env";

/** Raised when the SPA is misconfigured, or asked to do something forbidden. */
export class ApiBoundaryError extends Error {
  /** Machine-readable detail. Named `detail`, not `cause`, to avoid shadowing
   *  `Error.cause` (ES2022), which is typed `unknown`. */
  readonly detail: string;

  constructor(message: string, detail: string) {
    super(message);
    this.name = "ApiBoundaryError";
    this.detail = detail;
  }
}

/**
 * The Supabase role that must never appear in a browser bundle.
 *
 * This is the single place in `apps/web` where that role name is written down,
 * and it is written down in order to reject it. `scripts/check-boundaries.py`
 * and the ESLint boundary rule forbid the literal everywhere else under
 * `apps/web`.
 */
const SERVER_ONLY_ROLE = "service_role";

/** Prefix of the newer opaque Supabase secret-key format. */
const SERVER_ONLY_KEY_PREFIX = "sb_secret_";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const segment = parts[1];
  if (segment === undefined || segment.length === 0) {
    return null;
  }
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = atob(padded);
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * True when a token is a Supabase secret credential rather than the anon key.
 *
 * A runtime assertion rather than a lint rule, because a lint rule cannot see
 * the value a deployment injects. If this ever fires, the deployment is exposing
 * a total-compromise secret to the browser.
 */
export function isServerOnlyCredential(token: string): boolean {
  if (token.startsWith(SERVER_ONLY_KEY_PREFIX)) {
    return true;
  }
  const claims = decodeJwtPayload(token);
  return claims !== null && claims.role === SERVER_ONLY_ROLE;
}

function assertBrowserSafeCredential(key: string, value: string): void {
  if (!isServerOnlyCredential(value)) {
    return;
  }
  throw new ApiBoundaryError(
    `${key} holds a server-only Supabase credential and must never be exposed to the browser.`,
    "Replace it with the anon key. Server-side code reads secrets from Supabase Vault.",
  );
}

let cachedClient: SupabaseClient | null = null;
let cachedEnv: BrowserEnv | null = null;

/** The validated browser environment, computed once per page load. */
export function getBrowserEnv(): BrowserEnv {
  cachedEnv ??= readBrowserEnv();
  return cachedEnv;
}

/** True when the Supabase client can be constructed. Does not throw. */
export function isSupabaseConfigured(): boolean {
  return getBrowserEnv().ok;
}

/**
 * Returns the browser Supabase client.
 *
 * Created lazily so that importing this module never crashes the shell when
 * `.env` is absent — which is the correct state for a fresh checkout.
 */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient !== null) {
    return cachedClient;
  }

  const env = getBrowserEnv();
  if (!env.ok) {
    const detail = env.issues.map((issue) => `${issue.key}: ${issue.problem}`).join("; ");
    throw new ApiBoundaryError(
      "The browser environment is not configured; see .env.example.",
      detail,
    );
  }

  const url = env.values.VITE_SUPABASE_URL;
  const anonKey = env.values.VITE_SUPABASE_ANON_KEY;
  if (url === undefined || anonKey === undefined) {
    throw new ApiBoundaryError(
      "The Supabase URL or anon key is missing.",
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  assertBrowserSafeCredential("VITE_SUPABASE_ANON_KEY", anonKey);

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cachedClient;
}

/** Discards the cached client. Test support only. */
export function resetSupabaseClientForTests(): void {
  cachedClient = null;
  cachedEnv = null;
}
