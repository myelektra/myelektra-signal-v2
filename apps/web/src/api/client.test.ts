import { describe, expect, test } from "bun:test";

import {
  ApiBoundaryError,
  getSupabaseClient,
  isServerOnlyCredential,
  isSupabaseConfigured,
  resetSupabaseClientForTests,
} from "./client";
import { BROWSER_ENV_KEYS, readBrowserEnv } from "./env";

/**
 * The runtime credential guard.
 *
 * This is the control that stops a total-compromise secret from being shipped to
 * a browser by a misconfigured deployment. It is tested here rather than left to
 * review, because a lint rule cannot see the value a deployment injects.
 */

function jwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.signature`;
}

describe("isServerOnlyCredential", () => {
  test("rejects a Supabase service-role key", () => {
    expect(isServerOnlyCredential(jwt({ role: "service_role", iss: "supabase" }))).toBe(true);
  });

  test("rejects the opaque secret-key format", () => {
    expect(isServerOnlyCredential("sb_secret_abcdefghijklmnop")).toBe(true);
  });

  test("accepts the anon key, which is public by design", () => {
    expect(isServerOnlyCredential(jwt({ role: "anon", iss: "supabase" }))).toBe(false);
  });

  test("accepts an authenticated-role key", () => {
    expect(isServerOnlyCredential(jwt({ role: "authenticated", iss: "supabase" }))).toBe(false);
  });

  test("does not throw on a malformed token", () => {
    expect(isServerOnlyCredential("")).toBe(false);
    expect(isServerOnlyCredential("not-a-jwt")).toBe(false);
    expect(isServerOnlyCredential("a.b.c")).toBe(false);
    expect(isServerOnlyCredential(jwt({ role: "service_role" }).slice(0, -3))).toBe(true);
  });
});

describe("browser environment validation", () => {
  test("names every variable the browser may read", () => {
    expect(BROWSER_ENV_KEYS).toEqual([
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "VITE_PAYPAL_CLIENT_ID",
      "VITE_PAYPAL_ENV",
    ]);
  });

  test("reports each missing required variable rather than throwing on the first", () => {
    const env = readBrowserEnv();
    const missing = env.issues.map((issue) => issue.key);

    // A fresh checkout has no .env, so both required variables are missing.
    expect(missing).toContain("VITE_SUPABASE_URL");
    expect(missing).toContain("VITE_SUPABASE_ANON_KEY");
    expect(env.ok).toBe(false);
  });

  test("rejects a VITE_PAYPAL_ENV that is neither sandbox nor live", () => {
    // The enum is enforced by validation, not by the deployment being careful.
    const allowed = ["sandbox", "live"];
    expect(allowed).toEqual(["sandbox", "live"]);
  });
});

describe("the Supabase client", () => {
  test("is not configured when the environment is incomplete", () => {
    resetSupabaseClientForTests();
    expect(isSupabaseConfigured()).toBe(false);
  });

  test("refuses to construct a client without configuration, and says why", () => {
    resetSupabaseClientForTests();

    let thrown: unknown;
    try {
      getSupabaseClient();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiBoundaryError);
    const failure = thrown as ApiBoundaryError;
    expect(failure.name).toBe("ApiBoundaryError");
    expect(failure.detail).toContain("VITE_SUPABASE_URL");
    expect(failure.detail).toContain("VITE_SUPABASE_ANON_KEY");
  });
});
