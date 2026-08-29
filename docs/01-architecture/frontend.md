# Frontend Architecture

## Purpose

Define the SPA's responsibilities and, more importantly, its limits: it is a presentation layer with
no authority over data, money, roles, or access.

## Scope

In scope: stack, structure, state handling, the eight UI states, and the prohibitions. Out of scope:
per-screen specifications (`09-ui/*`) and authorization semantics
([authentication-authorization](../03-auth/authentication-authorization.md)).

## Source of truth

- `S1` Strategic brief — React, Vite, TypeScript, Vercel hosting; business rules must not live in
  React; route hiding is not authorization; all eight UI states required; no dummy production data.
- `S2` Legacy `DESIGN.md` (Clean Clay) and `docs/UI-DESIGN-REVIEW.md` — **not available** (OD-LC-2).
- `D` Design decisions proposed here.

## Requirements

### R-FE-1 Stack `S1`

React + Vite + TypeScript, deployed to Vercel. No server-side rendering requirement is stated in the
brief; if SEO for the homepage requires it, that is a decision (OD-FE-1), not an assumption.

### R-FE-2 Responsibility boundary `S1`

| The SPA does | The SPA never does |
| --- | --- |
| Renders data it is given | Computes a score or band |
| Routes between screens | Decides whether access is allowed |
| Collects a plan key | Sends an amount, currency, or status |
| Shows loading, empty, and error states | Infers "no data" from a failed request |
| Calls Supabase Auth and Edge Functions | Holds a secret of any kind |
| Presents an optimistic update | Treats an optimistic update as settled |

The import-boundary lint enforces the second column structurally: the SPA cannot import domain-core
or adapter modules, so a business rule cannot be placed in React by accident.

### R-FE-3 Eight states per route `S1`

Every route implements loading, empty, partial, failed, retryable error, mutation pending, success,
and stale data. Rules that make them meaningful:

- **Empty ≠ error.** An empty dashboard says "no Signals today"; a failed one says why and offers
  retry. Conflating them teaches customers that an outage is a quiet day.
- **Partial is labelled.** When part of a screen loaded and part did not, the failure is visible in
  place, not silently absent.
- **Retry works.** A retry control that re-renders without re-fetching is worse than no control.
- **Stale is indicated.** Data served from cache past its freshness window says so.
- **Mutation pending disables the control** and shows progress, preventing double submission — which
  for a checkout is a double-charge risk.

### R-FE-4 Data fetching `D`

Server state and client state are separated. Server state is fetched, cached, invalidated, and
refetched by a data layer; it is never copied into component state where it goes stale silently.
Mutations invalidate the queries they affect rather than patching caches by hand.

### R-FE-5 Secrets `S1`

No secret in the bundle. Only the Supabase **anon/public** key and the PayPal **public** client id
appear client-side. The service-role key is referenced nowhere in the SPA and its presence in build
output fails the build. Environment values are prefixed so that only explicitly public ones are
inlined by Vite.

### R-FE-6 Content rules `S1`

No fake testimonials, logos, or scarcity. No guaranteed leads, revenue, or meetings. No dummy
production data — an empty state is honest, an invented Signal is not. See
[product-requirements R-PR-6](../00-product/product-requirements.md#r-pr-6-content-rules-s1).

### R-FE-7 Accessibility and responsiveness `S1`

Every route is keyboard-navigable and passes an automated axe scan; every route is checked at 360px,
768px, and 1440px. Accessibility is a gate, not a polish task, and in a payment flow it is a
functional requirement: an inaccessible error state is an error a user cannot act on.

### R-FE-8 Design system `X`

The brief names **Clean Clay** as the design system. Its definition was in the legacy `DESIGN.md`,
which is unavailable. Phase 5 therefore has no authoritative visual source. **OD-LC-2 / B-1.**

This document does not invent a design system. What it asserts is the constraint that survives
without one: tokens are centralized, so that supplying the real definitions later is a token change
rather than a rewrite.

## Security considerations

- **The bundle is public.** Anything in it is readable by anyone, so the only safe assumption is that
  every value in the bundle is known to an attacker.
- **Route guards are not authorization** (R-AU-5). A guard that hides a screen is a UX courtesy; the
  server must deny the data independently.
- **External content is rendered as text.** Signal evidence and source names come from the open web;
  rendering them as HTML is a stored-XSS vector. Links are validated as `http(s)` before being made
  clickable.
- **Optimistic UI must not imply settlement.** Showing "payment complete" before server verification
  would grant access on buyer intent — the client-side form of the classic PayPal defect.
- **No client-side cron.** No `setInterval`-driven scheduled work exists in the SPA.

## Acceptance criteria

- [ ] The import-boundary lint fails the build if the SPA imports domain-core or adapter code.
- [ ] The bundle scan finds no service-role key or secret pattern.
- [ ] Every route renders all eight states, each covered by a test.
- [ ] Empty and error states are visually and textually distinct on every route.
- [ ] Every retry control re-fetches, asserted by test.
- [ ] Every route is keyboard-navigable and passes axe.
- [ ] Every route is verified at 360px, 768px, and 1440px.
- [ ] No component contains hardcoded pricing that can drift from `packages`.
- [ ] No `setInterval`-driven scheduled work exists in client code.

## Related skills

- [`refactoring-ui`](../SKILLS.md#refactoring-ui) — hierarchy and spacing without a design system in hand.
- [`web-typography`](../SKILLS.md#web-typography) — the Signal detail view is text-dense.
- [`design-everyday-things`](../SKILLS.md#design-everyday-things) — R-FE-3's state affordances.
- [`ux-heuristics`](../SKILLS.md#ux-heuristics) — visibility of system status, error recovery.
- [`clean-architecture`](../SKILLS.md#clean-architecture) — the boundary in R-FE-2.

## Open decisions

- **OD-FE-1** Is SSR/SSG needed for the homepage's SEO? The brief specifies an SPA.
- **OD-LC-2** Clean Clay definition. **Blocks Phase 5 visual work.**
- **OD-FE-2** Data-fetching library choice.
- **OD-FE-3** Internationalization. The brief is USD-only and English-implied; not stated.
- **OD-FE-4** Whether the Signal detail's six sections are tabs, stacked, or progressive disclosure —
  a design decision needing the design system.
