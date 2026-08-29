/**
 * Import-boundary spike function.
 *
 * Its only job is to prove requirement 6 of Phase 1B: a Supabase Edge Function
 * can import `@myelektra/domain` and `@myelektra/contracts` through the
 * `supabase/deno.json` import map, against the *shared TypeScript source* —
 * strategy A in foundation-plan R-FN-12.
 *
 * It is not a product endpoint. It holds no business logic, touches no
 * database, performs no authentication, and processes no payment. It reads two
 * module constants and calls one pure predicate, so a green response proves the
 * import resolves at runtime and not merely at typecheck time.
 *
 * Nothing is copied into `supabase/functions/_shared/`. The import map points at
 * `../packages/*` directly, so there is one source of truth and no stale
 * generated duplicate (foundation-plan R-FN-12; R-FN-14 documents the fallback
 * if a deploy step ever rejects that path).
 */
import type { SpikeResponse } from "@myelektra/contracts";
import { CONTRACTS_PACKAGE, SPIKE_PATH } from "@myelektra/contracts";
import { DOMAIN_PACKAGE, DOMAIN_VERSION, isNonEmptyString } from "@myelektra/domain";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
} as const;

/**
 * Handles a request. Exported so it can be unit-tested without opening a port.
 */
export function handler(request: Request): Response {
  const { pathname } = new URL(request.url);

  if (pathname !== SPIKE_PATH) {
    return Response.json(
      { error: { code: "not_found", message: "No such route.", schemaVersion: "0" } },
      { status: 404, headers: JSON_HEADERS },
    );
  }

  // A *call* into the domain package, not just a type reference: this is what
  // distinguishes a live import from a declaration that happens to typecheck.
  const predicate = isNonEmptyString(DOMAIN_PACKAGE) && isNonEmptyString(CONTRACTS_PACKAGE);

  const body: SpikeResponse = {
    path: SPIKE_PATH,
    ok: true,
    domain: `${DOMAIN_PACKAGE}@${DOMAIN_VERSION}`,
    contracts: CONTRACTS_PACKAGE,
    predicate,
  };

  return Response.json(body, { status: 200, headers: JSON_HEADERS });
}

export default handler;

Deno.serve(handler);
