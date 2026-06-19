# Car Rental Platform — CLAUDE.md

White-label car rental platform. Service providers run their own branded fleets; **customers** book via a mobile app, **providers** (and their **staff**) manage operations via a web dashboard, and a platform **admin** oversees every tenant. Vehicle access is **keyless via an OTP lock-box** — no physical key exchange (the core access mechanism).

> Recreation of an earlier build with three deliberate changes: **web is Next.js (full-stack)** not React+Vite, the **backend folds into Next.js** (route handlers + server actions) instead of a standalone Express monolith, and there is a new platform **admin** role. Design is the new **"Sunset Drive"** system (see `design.md`), replacing the old dark theme.

## Architecture

**npm-workspaces monorepo**, single git repo.

| Workspace | Stack | Role |
|-----------|-------|------|
| `apps/web` | **Next.js 16 (App Router) + TS** — full-stack | Backend (route handlers + server actions, Prisma, auth, realtime) **and** the provider dashboard + `/admin` panel. Exposes `/api/*` REST consumed by mobile. |
| `apps/mobile` | **Expo (dev client) RN + TS** | Customer app (iOS/Android). Consumes `apps/web`'s `/api/*`. |
| `packages/types` | TS | Shared API contracts — the **source of truth** (enums, DTOs, zod schemas). Imported by both `web` and `mobile`, never duplicated. |
| `packages/tokens` | TS | Design tokens (framework-agnostic) + CSS-variable generator (web) + `ThemeProvider`/`useTheme` (RN). |

The backend lives inside `apps/web` as a **modular monolith by domain** (`src/server/modules/<domain>`: auth, fleet, bookings, payments, otp, notifications, …) with clean route → action/handler → service → repository boundaries, extractable later. **Change an API shape once in `@car-rental/types`; both clients see it.**

### Why Next.js full-stack (and its sharp edges)
- One deployable serves web UI + the API for mobile. Fewer moving parts; shared TS end-to-end.
- **Realtime:** Socket.io does not fit Next.js serverless. Booking-status push uses **SSE or a managed realtime service** (decided in the realtime phase), not a long-lived socket server.
- **Mobile coupling:** mobile depends on `apps/web` being deployed. Keep the `/api/*` surface a clean REST contract (typed via `@car-rental/types`) so the boundary stays honest.

## Roles (4)

- **CUSTOMER** (mobile) — register → browse → customize booking → pay → OTP keyless pickup → return → rate.
- **PROVIDER** (web `/dashboard`) — owns their tenant: fleet, pricing, bookings, branches, staff, finances, analytics, support.
- **STAFF** (web `/dashboard`, scoped) — provider employees with assigned permissions for day-to-day ops.
- **ADMIN** (web `/admin`) — **platform super-admin across ALL tenants**: approve/suspend providers, platform-wide analytics, global settings, onboarding.

## Multi-tenancy (white-label)

- `Provider` **is the tenant**. Every tenant-owned row carries `providerId`.
- **Tenant isolation is P0.** Providers/staff are scoped to their own `providerId`; only ADMIN crosses tenants. Enforce in the DAL on every authenticated read, and in **every cache key** (`cacheTag('<entity>:<providerId>')`). A forgotten tenant scope = data leak.
- Branding (logo, colors, app name, copy) is **config-driven per provider**, never hardcoded — see `design.md` white-label derivation.

## Auth

Dual credential, one user/session model:
- **Web** → httpOnly cookie session.
- **Mobile** → bearer JWT in `Authorization`, token in secure storage.
- All authenticated reads go through a **Data Access Layer** (`src/server/auth/dal.ts`); every server action / mutation starts with `verifySession()` then a role/tenant check. Pages and components never query the DB directly.

## Tech defaults

- **TS strict** everywhere, avoid `any`. Functional components + hooks only (no classes).
- **Web:** Next.js 16 App Router, **Tailwind** wired to design tokens (CSS variables), `next-intl` for i18n. **Mobile:** Expo RN + React Navigation.
- **State:** Server Components / server actions + React Query (or RSC data) on web; Redux Toolkit (complex flows) / Context (local) on mobile. Same role-vocabulary across both.
- **DB:** PostgreSQL + Prisma. Relational integrity is critical for bookings/payments/financial records.
- **Payments:** Stripe + cash-on-delivery first (PayPal/local later). PCI — never log or persist raw card data; tokenize via gateway.
- **Realtime/infra:** SSE/managed realtime (booking status); Twilio + FCM (OTP + push); Google Maps (branches); S3/Cloudinary (images & docs); containerized cloud + CI/CD.

## Next.js conventions (16+)

These are enforced — match them, don't regress to older patterns:
- **`proxy.ts`** (not `middleware.ts`); **awaited** `params`/`searchParams` (they are Promises).
- **`'use cache'` + `cacheLife`/`cacheTag`** for caching (not `export const dynamic/revalidate`); **`updateTag`** after mutations (not `revalidateTag`).
- **DAL discipline** — authenticated reads only via `dal.ts`; server actions start with `verifySession()`.
- **Tenant isolation** — every `'use cache'` fn that touches tenant data takes `providerId` and tags `<entity>:<providerId>`.
- **Architecture direction** — one-way deps: `app → features → shared → ui`. No cross-feature imports; `ui` (primitives) imports from nothing above.
- **Design tokens** — no raw hex/oklch in JSX (CSS variables only); Tailwind **logical** properties only (`ms-/me-/ps-/pe-`, never `ml-/mr-`); `rounded-full` only on avatars/icon-only buttons.
- **i18n** — no hardcoded user-visible strings (always `t()`); RTL-safe logical layout; locale-aware date/number/currency formatters.

## Non-negotiable product constraints

- **OTP lock-box** is core and security-sensitive: bind OTP to **booking + vehicle + time window**; expire on use and at window end; server-authoritative verification; auditable. Flow: confirmed → OTP issued pre-pickup → unlock box → digital contract signing → return inspection.
- **i18n AR + EN.** Arabic is **RTL** — build RTL-aware from the start (logical props, `I18nManager` on RN, `dir`-aware web); never hardcode LTR or copy strings.
- **White-label:** branding is config per provider, never hardcoded.
- **Flexible rental plans:** daily / weekly / monthly / long-term with dynamic + seasonal pricing.

## Booking lifecycle (authoritative status model)

`reserved → confirmed → vehicle-prepared → picked-up → returned → completed` (+ terminal `rejected` / `cancelled`). Provider drives transitions; customer sees them in real time. The enum is owned by the backend (`@car-rental/types` → `BookingStatus`); clients never invent status strings; illegal transitions are rejected server-side.

## Design system

The **"Sunset Drive"** system (full spec in `design.md`): warm coral-amber brand (`#F97316`) + teal accent (`#0EA5A4`), deep-navy ink, warm-cream surfaces; light default with a dark sibling. **Centralized typed tokens** (color/spacing/type/radius/elevation/z-index/motion); components never inline a hex/px/font — semantics only, lint-enforced. Tokens are themeable for color (per-provider white-label) but static for layout. One UI vocabulary across web + mobile.

## Workflow

- **No `git commit` / `push` unless asked.** Show a plan before large refactors or new deps. Package manager: **npm workspaces** (`npm run <script> -w @car-rental/<app>`).
- **Backend changes:** call out needed Prisma migrations + new env vars (gateway keys, Twilio, FCM, Maps, S3) explicitly.
- **Testing:** unit + integration + e2e — cover OTP, payment, and booking-lifecycle paths first.
- Delivery is **phased** (see `plan.md`); each phase is its own spec → plan → build with a verifiable gate.

## Working principles

Bias toward caution over speed; use judgment on trivial tasks.

- **Think before coding.** State assumptions; if uncertain, ask. Surface multiple interpretations instead of silently picking one.
- **Simplicity first.** Minimum code that solves the problem — no speculative abstractions or error handling for impossible cases.
- **Surgical changes.** Touch only what the request requires; match existing style; flag pre-existing dead code, don't delete it.
- **Goal-driven execution.** Turn tasks into verifiable goals; for multi-step work, state a brief plan with a verify-step each, then loop until verified.
