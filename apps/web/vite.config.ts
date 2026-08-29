import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Vite configuration for the SPA (foundation-plan R-FN-4).
 *
 * Only `VITE_`-prefixed variables are inlined into the bundle. That prefix is a
 * security boundary, not a naming preference: an unprefixed variable is not
 * reachable from the client, and adding one to `.env.example` is a decision
 * about what becomes public (foundation-plan R-FN-3, secrets R-SE-1).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so the app is reachable outside this container.
    host: true,
    port: 5173,
    // The dev server is reached through a dynamically-named tunnel host. This
    // affects the dev server only; the production build has no dev server.
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    // Vercel root directory is apps/web; the output directory is dist (R-FN-4).
    outDir: "dist",
    // No sourcemaps in production. A .map file republishes the original source
    // to anyone who fetches it, and there is no error-tracking pipeline to
    // consume them yet. Revisit when one exists (Phase 8).
    sourcemap: false,
    target: "es2022",
    emptyOutDir: true,
  },
});
