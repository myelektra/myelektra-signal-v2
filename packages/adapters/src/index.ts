/**
 * `@myelektra/adapters` — Layer 2, provider clients behind interfaces.
 *
 * Layering rule (system-architecture R-SA-3): adapters may import `domain` and
 * `contracts`, plus the server environment. They must never be imported by
 * `apps/web` — an adapter holds a provider credential path, so shipping one to
 * the browser is a secret-exposure defect, not a style problem. Enforced by
 * ESLint and by `scripts/check-boundaries.py`.
 *
 * **Phase 1B status: placeholder. No provider client exists yet.** PayPal,
 * OpenAI, search, and email adapters are deferred (foundation-plan R-FN-11) and
 * their integrations are blocked decisions (OD-PP-1). Adding a client here
 * before its consumer exists would provision a credential with no consumer,
 * which secrets R-SE-1 forbids.
 *
 * The two imports below exist to prove the dependency direction compiles under
 * both runtimes — Bun/`tsc` for the workspace, and Deno for
 * `supabase/functions`. They are not a provider client.
 */
import type { ApiErrorEnvelope } from "@myelektra/contracts";
import { DOMAIN_VERSION } from "@myelektra/domain";

/** Package identity. */
export const ADAPTERS_PACKAGE = "@myelektra/adapters" as const;

/** Package version, kept in sync with `package.json` by hand for now. */
export const ADAPTERS_VERSION = "0.0.0" as const;

/** The domain version this build was compiled against. */
export const ADAPTERS_BUILT_AGAINST_DOMAIN = DOMAIN_VERSION;

/**
 * A transport failure surfaced by a provider call, before any provider-specific
 * detail is attached. Provider error mapping arrives with the adapters
 * themselves, not before.
 */
export type AdapterTransportError = ApiErrorEnvelope["error"];
