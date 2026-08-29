/// <reference types="vite/client" />

/**
 * Browser-exposed environment (foundation-plan R-FN-3, secrets R-SE-1).
 *
 * Only these four variables may ever reach the bundle, because only these four
 * are `VITE_`-prefixed. Adding a variable here is a decision to make a value
 * public.
 *
 * No server-side variable may be added to this interface. Server-side secrets
 * live in Supabase Vault and are read inside Edge Functions only.
 */
interface ImportMetaEnv {
  /** Supabase project URL. Public. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon key. Public by design — RLS is the control, not this key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** PayPal *public* client id, for the browser SDK only. Deferred to Phase 7. */
  readonly VITE_PAYPAL_CLIENT_ID?: string;
  /** `sandbox` | `live`. Per deployment, never request-driven. Deferred to Phase 7. */
  readonly VITE_PAYPAL_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
