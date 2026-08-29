import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Boundary rules for Myelektra Signal v2.
 *
 * These are security controls, not style preferences. They are what keep
 * scoring, pricing, access, and provider credentials out of code that ships to a
 * browser (foundation-plan R-FN-2, legacy-exclusion-list R-LC-2).
 *
 * Scope of this file, and why it is not everything:
 *
 * `no-restricted-imports` matches `patterns` with gitignore semantics (the
 * `ignore` package), where a negation cannot distinguish a relative import from
 * a bare specifier. A deny-by-default allowlist is therefore *not* expressible
 * here, and an attempt at one fails open rather than closed. So this file
 * carries the explicit deny list; `scripts/check-boundaries.py` carries the
 * strict allow list, including dynamic `import()` and `require()`, which
 * `no-restricted-imports` cannot see.
 *
 * `supabase/functions` is excluded — Deno lints and formats it with its own
 * rules, and applying ESLint there would enforce browser assumptions on a
 * server runtime.
 */

const R_FN_2 = "See docs/01-architecture/foundation-plan.md (R-FN-2).";

/**
 * Verified against real specifiers, including the relative-escape form
 * `../../packages/domain/src/index`. Do not edit these globs without re-running
 * the boundary negative test.
 */
const WORKSPACE_ESCAPE_PATTERNS = [
  "@myelektra/domain",
  "@myelektra/domain/**",
  "@myelektra/adapters",
  "@myelektra/adapters/**",
  "**/packages/domain/**",
  "**/packages/adapters/**",
];

const PROVIDER_SDK_PATTERNS = [
  "@paypal/checkout-server-sdk",
  "@paypal/checkout-server-sdk/**",
  "@paypal/paypal-server-sdk",
  "@paypal/paypal-server-sdk/**",
  "openai",
  "openai/**",
  "@openai/**",
  "@anthropic-ai/**",
  "algoliasearch",
  "@algolia/**",
  "serpapi",
  "@serpapi/**",
  "resend",
  "@sendgrid/**",
  "nodemailer",
  "postmark",
];

const SERVER_DATA_ACCESS_PATTERNS = ["@supabase/ssr", "postgres", "pg", "@supabase/postgres-meta"];

/** Forbidden from every module under apps/web. */
const WEB_FORBIDDEN_PATHS = [
  {
    name: "@myelektra/domain",
    message: `apps/web must not import the domain package: business rules must not ship to the browser. ${R_FN_2}`,
  },
  {
    name: "@myelektra/adapters",
    message: `apps/web must not import adapters: they wrap server-side provider clients. ${R_FN_2}`,
  },
  {
    name: "@supabase/supabase-js",
    message: `@supabase/supabase-js may be imported only from apps/web/src/api/client.ts. ${R_FN_2}`,
  },
  {
    name: "@paypal/checkout-server-sdk",
    message: `Server-only PayPal SDK. apps/web/src/api may use the browser SDK only. ${R_FN_2}`,
  },
  {
    name: "@paypal/paypal-server-sdk",
    message: `Server-only PayPal SDK. apps/web/src/api may use the browser SDK only. ${R_FN_2}`,
  },
];

const WEB_FORBIDDEN_PATTERNS = [
  {
    group: WORKSPACE_ESCAPE_PATTERNS,
    message: `apps/web must not reach the domain or adapters packages, by specifier or by relative path. ${R_FN_2}`,
  },
  {
    group: PROVIDER_SDK_PATTERNS,
    message: `Provider SDK: server-side only. Reach it through the API boundary. ${R_FN_2}`,
  },
  {
    group: SERVER_DATA_ACCESS_PATTERNS,
    message: `Server-only data access. ${R_FN_2}`,
  },
];

/**
 * Forbidden from apps/web outside `src/api/`. Inside `src/api/` the browser
 * Supabase client and the PayPal browser SDK are allowed, so those two entries
 * are dropped there.
 */
const SUPABASE_JS_PATH = WEB_FORBIDDEN_PATHS.find((p) => p.name === "@supabase/supabase-js");
const PAYPAL_BROWSER_SDK = ["@paypal/paypal-js", "@paypal/react-paypal-js"];

/** A server-only credential must not be named anywhere in the browser app. */
const SERVICE_ROLE_SYNTAX_RULES = [
  "error",
  {
    selector: "Literal[value=/service_role/i]",
    message: `A server-only Supabase credential must never be referenced in apps/web. ${R_FN_2}`,
  },
  {
    selector: "TemplateElement[value.raw=/service_role/i]",
    message: `A server-only Supabase credential must never be referenced in apps/web. ${R_FN_2}`,
  },
  {
    selector: "Identifier[name=/SERVICE_ROLE/]",
    message: `A server-only Supabase credential must never be referenced in apps/web. ${R_FN_2}`,
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "supabase/functions/**",
      "supabase/.temp/**",
      "bun.lock",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },

  // --- apps/web/src/api: the boundary layer ---------------------------------
  // May import contracts, the browser Supabase client (from client.ts only),
  // and the PayPal browser SDK. Everything privileged stays out.
  {
    files: ["apps/web/src/api/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/api/client.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: WEB_FORBIDDEN_PATHS, patterns: WEB_FORBIDDEN_PATTERNS },
      ],
    },
  },

  // ...except client.ts, the single module allowed to construct a client. It
  // still may not touch domain, adapters, or a provider SDK.
  {
    files: ["apps/web/src/api/client.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: WEB_FORBIDDEN_PATHS.filter((p) => p !== SUPABASE_JS_PATH),
          patterns: WEB_FORBIDDEN_PATTERNS,
        },
      ],
    },
  },

  // --- apps/web/src, everything else ----------------------------------------
  // No client library at all: these modules import @myelektra/contracts or
  // ./api. The allow-list half of this rule lives in check-boundaries.py.
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...WEB_FORBIDDEN_PATHS,
            ...PAYPAL_BROWSER_SDK.map((name) => ({
              name,
              message: `The PayPal browser SDK may be loaded only inside apps/web/src/api. ${R_FN_2}`,
            })),
          ],
          patterns: WEB_FORBIDDEN_PATTERNS,
        },
      ],
    },
  },

  // A server-only credential name appears nowhere in apps/web except the one
  // module that exists to reject it.
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/api/client.ts", "apps/web/vite.config.ts"],
    rules: { "no-restricted-syntax": SERVICE_ROLE_SYNTAX_RULES },
  },

  // --- packages/domain: dependency-free -------------------------------------
  {
    files: ["packages/domain/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@myelektra/contracts", message: "domain must not depend on contracts." },
            { name: "@myelektra/adapters", message: "domain must not depend on adapters." },
            { name: "react", message: "domain must not depend on React." },
            { name: "@supabase/supabase-js", message: "domain performs no I/O." },
          ],
          patterns: [
            {
              group: [
                "@myelektra/contracts",
                "@myelektra/contracts/**",
                "@myelektra/adapters",
                "@myelektra/adapters/**",
                "@supabase/**",
                "react",
                "react/**",
                "react-dom",
                "react-dom/**",
                "node:**",
                "fs",
                "path",
                "http",
                "https",
                "crypto",
                "pg",
                "postgres",
                ...PROVIDER_SDK_PATTERNS,
              ],
              message:
                "packages/domain is the pure core: no I/O, no database client, no provider SDK, no React (system-architecture R-SA-3).",
            },
          ],
        },
      ],
    },
  },

  // --- packages/contracts: browser-safe, self-contained ---------------------
  {
    files: ["packages/contracts/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@myelektra/domain", message: "contracts must stay self-contained." },
            { name: "@myelektra/adapters", message: "contracts must stay self-contained." },
          ],
          patterns: [
            {
              group: [
                "@myelektra/domain",
                "@myelektra/domain/**",
                "@myelektra/adapters",
                "@myelektra/adapters/**",
                "@supabase/**",
                "react",
                "react/**",
                "node:**",
                "pg",
                "postgres",
                ...PROVIDER_SDK_PATTERNS,
              ],
              message:
                "packages/contracts is inlined into a browser bundle and must stay self-contained: no provider SDK, no database types, no server-only reference.",
            },
          ],
        },
      ],
    },
  },

  // --- packages/adapters: server-side, may use domain and contracts ---------
  {
    files: ["packages/adapters/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "Adapters are server-side and must not depend on React." },
          ],
          patterns: [
            {
              group: ["react", "react/**", "react-dom", "react-dom/**", "vite", "@vitejs/**"],
              message: "Adapters are server-side and must not depend on the frontend toolchain.",
            },
            {
              group: ["**/apps/**", "@myelektra/web"],
              message: "Dependency direction is one-way: adapters must not import apps (R-SA-3).",
            },
          ],
        },
      ],
    },
  },

  // --- runtime separation ---------------------------------------------------
  // The workspace is one typecheck project, so `lib` cannot keep a browser
  // global out of a package. This rule does, and in the other direction too.
  {
    files: ["packages/*/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...["window", "document", "localStorage", "sessionStorage"].map((name) => ({
          name,
          message: "This package must not depend on a browser. Move it behind the API boundary.",
        })),
      ],
    },
  },

  {
    files: ["apps/web/**/*.{ts,tsx}"],
    ignores: ["apps/web/vite.config.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "process",
          message:
            "process is a server global and is not defined in the browser. Read VITE_ variables from import.meta.env via src/api.",
        },
        {
          name: "Deno",
          message: "Deno is an Edge Function runtime global; it does not exist in the browser.",
        },
        {
          name: "Bun",
          message: "Bun is a server runtime global; it does not exist in the browser.",
        },
        { name: "require", message: "Use ESM imports." },
        { name: "__dirname", message: "Not available in the browser." },
      ],
    },
  },

  // --- toolchain files run in Node/Bun, not the browser ---------------------
  {
    files: ["*.config.{js,ts}", "apps/web/vite.config.ts"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },
);
