/**
 * Reads and validates the browser environment.
 *
 * Validation happens here rather than at the point of use, so a misconfigured
 * deployment fails loudly with a named variable instead of failing deep inside a
 * request (foundation-plan R-FN-3).
 *
 * Nothing in this module talks to the network, and nothing here holds a secret:
 * every variable it reads is public by design.
 */

/** Every variable the browser is allowed to read. See `vite-env.d.ts`. */
export const BROWSER_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_PAYPAL_CLIENT_ID",
  "VITE_PAYPAL_ENV",
] as const;

export type BrowserEnvKey = (typeof BROWSER_ENV_KEYS)[number];

/** Required for the SPA to reach Supabase at all. */
export const REQUIRED_BROWSER_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
] as const satisfies readonly BrowserEnvKey[];

/**
 * Documented now, required from Phase 7. Absence is not an error in Phase 1B,
 * because provisioning a PayPal credential before its consumer exists is what
 * secrets R-SE-1 forbids.
 */
export const DEFERRED_BROWSER_ENV_KEYS = [
  "VITE_PAYPAL_CLIENT_ID",
  "VITE_PAYPAL_ENV",
] as const satisfies readonly BrowserEnvKey[];

/** The only accepted values for `VITE_PAYPAL_ENV` (deployment R-DP-2). */
export const PAYPAL_ENVIRONMENTS = ["sandbox", "live"] as const;

export type PaypalEnvironment = (typeof PAYPAL_ENVIRONMENTS)[number];

export interface EnvIssue {
  readonly key: BrowserEnvKey;
  readonly problem: string;
}

export interface BrowserEnv {
  /** Trimmed, non-empty values only. */
  readonly values: Readonly<Partial<Record<BrowserEnvKey, string>>>;
  readonly issues: readonly EnvIssue[];
  readonly ok: boolean;
}

function isPaypalEnvironment(value: string): value is PaypalEnvironment {
  return (PAYPAL_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Reads `import.meta.env` and reports every problem found, rather than throwing
 * on the first one. A shell that can report "two variables are missing" is more
 * useful than one that crashes.
 */
export function readBrowserEnv(): BrowserEnv {
  const source = import.meta.env;
  const values: Partial<Record<BrowserEnvKey, string>> = {};
  const issues: EnvIssue[] = [];

  for (const key of BROWSER_ENV_KEYS) {
    const raw = source[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      values[key] = raw.trim();
    }
  }

  for (const key of REQUIRED_BROWSER_ENV_KEYS) {
    if (values[key] === undefined) {
      issues.push({ key, problem: "missing or empty" });
    }
  }

  const url = values.VITE_SUPABASE_URL;
  if (url !== undefined) {
    let parsed: URL | undefined;
    try {
      parsed = new URL(url);
    } catch {
      parsed = undefined;
    }
    if (parsed === undefined || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
      issues.push({ key: "VITE_SUPABASE_URL", problem: "must be an absolute http(s) URL" });
    } else if (
      parsed.protocol === "http:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      issues.push({
        key: "VITE_SUPABASE_URL",
        problem: "plain http is allowed only for a local project",
      });
    }
  }

  const paypalEnv = values.VITE_PAYPAL_ENV;
  if (paypalEnv !== undefined && !isPaypalEnvironment(paypalEnv)) {
    issues.push({
      key: "VITE_PAYPAL_ENV",
      problem: `must be one of: ${PAYPAL_ENVIRONMENTS.join(", ")}`,
    });
  }

  return { values, issues, ok: issues.length === 0 };
}
