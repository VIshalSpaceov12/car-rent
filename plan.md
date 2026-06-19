# Car Rental Platform — Delivery Plan (`plan.md`)

Phased roadmap for the white-label car-rental platform. **Goal = the full platform**; the path there is sequenced — each phase is its own spec → plan → build with a **verifiable gate**. i18n (AR/EN + RTL), white-label, security, and **tenant isolation** are **cross-cutting** — built into every phase, never bolted on. See `CLAUDE.md` (architecture/conventions) and `design.md` (Sunset Drive tokens).

## Stack snapshot

- **Monorepo:** npm workspaces — `apps/web` (Next.js 16 full-stack), `apps/mobile` (Expo RN), `packages/types`, `packages/tokens`.
- **Backend:** inside `apps/web` — route handlers + server actions, Prisma + PostgreSQL, modular monolith by domain.
- **Auth:** cookie session (web) + bearer JWT (mobile), one user/session model, DAL-gated.
- **Roles:** CUSTOMER (mobile), PROVIDER + STAFF (web `/dashboard`), ADMIN (web `/admin`, all tenants).

## Phase table

| Phase | Delivers | Gate |
|---|---|---|
| **0 — Foundation + design system** | Monorepo + tooling; `@car-rental/types` + `@car-rental/tokens` (Sunset Drive); Next.js shell (Tailwind↔tokens, i18n/RTL, DAL, Prisma+Postgres, dual auth, `/dashboard`+`/admin`+`/api` shells, login); Expo shell (nav, theme, i18n, api client, login); multi-tenant base + seed. | Auth e2e on all 3 surfaces (customer→mobile, provider→`/dashboard`, admin→`/admin`); DB migrate+seed; `typecheck`+`lint`+`test` green. |
| **1 — Fleet & catalog** | Provider fleet CRUD, categories, branches; customer browse/search/filter/details. | Provider creates a vehicle → appears in mobile browse + detail. |
| **2 — Booking core** | Booking customization (dates/branch/plan), dynamic + seasonal pricing, itemized checkout quote, lifecycle state machine (server-authoritative transitions). | Customer creates booking; illegal transitions rejected. |
| **3 — Payments** | Stripe (tokenized) + cash-on-delivery, refunds, financial records. PCI: no raw card data logged/stored. | Pay moves `reserved → confirmed`; failed pay stays unpaid. *Security review.* |
| **4 — OTP lock-box** | OTP issuance/verification bound to booking+vehicle+window, digital contract signing, return inspection. | Keyless pickup e2e: issue OTP → verify → sign → `picked-up`. *Security review.* |
| **5 — Realtime & notifications** | Booking-status push (SSE/managed realtime), Twilio SMS + FCM push. | Status change on web appears live on mobile. |
| **6 — Engagement & ops** | History/receipts, loyalty, addresses, support, digital docs; provider analytics/marketing/maintenance/staff/insurance. | Customer re-books from history; provider runs a promo + sees analytics. |
| **7 — Admin platform** | Tenant approve/suspend, provider onboarding, platform-wide analytics, global settings. | Admin onboards a new provider with no code change. |
| **8 — i18n + white-label hardening + polish** | Full AR/EN/RTL pass, per-provider theming across all surfaces, reduce-motion, perf. | EN+AR verified on every screen; provider brand override flows end-to-end. |

> Admin is first-class: a minimal admin shell + provider record land in **Phase 0**; depth (analytics, onboarding flows) is **Phase 7**.

---

## Phase 0 — Foundation + design system (detailed)

**Objective:** every surface boots, shares one type/token contract, authenticates a user of each role, and reads/writes a multi-tenant Postgres DB — nothing feature-rich yet, but the spine is real and the gates are green.

### 0.1 Monorepo & tooling
- npm-workspaces root (`package.json` workspaces `apps/*`, `packages/*`), Node 20+, TS strict `tsconfig.base.json`.
- ESLint (incl. token/i18n/logical-prop rules) + Prettier; root scripts `dev:web`, `dev:mobile`, `typecheck`, `lint`, `test`, `db:migrate`, `db:seed`.
- `.gitignore` (incl. `.superpowers/`, `.env*`, `node_modules`, `.next`, `.expo`), `.env.example`, CI workflow running the gates against a Postgres service. `git init`.

### 0.2 `packages/types`
- `BookingStatus`, `UserRole` (CUSTOMER/PROVIDER/STAFF/ADMIN), `Locale`, `RentalPlan`, `PaymentMethod/Status`, vehicle enums.
- Core DTOs + zod schemas for auth (`LoginRequest`, `SessionUser`) and health. Wire format = kebab-case; map to DB UPPER_SNAKE at the repo boundary.

### 0.3 `packages/tokens` (Sunset Drive)
- `primitives.ts` (private), `themes/light.ts` + `themes/dark.ts`, `theme.ts` (`createTheme`, `lightTheme`, `darkTheme`, `defaultTheme=light`), `css.ts` (CSS-var emitter for web), RN `ThemeProvider`/`useTheme`, `index.ts`.
- Exact values from `design.md`. Compile-time `ColorScheme`/`Theme` exhaustiveness.

### 0.4 `apps/web` (Next.js 16 full-stack shell)
- App Router; Tailwind theme bound to token CSS vars; `next-intl` (EN/AR) + `dir`-aware root layout (RTL).
- Prisma + Postgres: schema for `Provider` (tenant, branding, settings), `User` (role, providerId?, locale), `Session`; migration + seed (1 provider "DriveHub", 1 admin, 1 provider user, 1 staff, 1 customer).
- Auth: `src/server/auth/` — password hashing, session issue/verify; **cookie** for web, **bearer JWT** for mobile; `dal.ts` (`verifySession`, role/tenant guards). `proxy.ts` route protection.
- Routes: `/(auth)/login`, `/(provider)/dashboard` (shell + Sidebar/StatCard placeholders), `/admin` (shell, ADMIN-only), `/api/health`, `/api/auth/login` + `/api/auth/me` (mobile). DAL-gated; tenant-scoped.

### 0.5 `apps/mobile` (Expo shell)
- Expo dev client, React Navigation (native-stack + bottom-tabs w/ `FloatingTabBar`), `ThemeProvider` from `@car-rental/tokens`, `i18n` (EN/AR + `I18nManager` RTL), typed API client → `apps/web` `/api/*`.
- Onboarding gate + Login → calls `/api/auth/login`, stores JWT in secure storage, fetches `/api/auth/me`; themed StatusBar; light default.

### 0.6 Cross-cutting (baked in)
- Tenant isolation in DAL + cache tags; no hardcoded strings (all via `t()`); logical props only; no raw hex in JSX.

### Phase 0 verification (the gate)
1. `npm run db:migrate && npm run db:seed` succeeds.
2. **Web:** provider logs in → `/dashboard`; admin logs in → `/admin`; non-admin blocked from `/admin`; provider data tenant-scoped.
3. **Mobile:** customer logs in → authed tab shell; `/api/auth/me` returns the session user.
4. `GET /api/health` ok; EN↔AR toggle flips `dir`/layout on one screen each.
5. `npm run typecheck && npm run lint && npm run test` all green; CI green.

**Env vars introduced:** `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET` (later phases add Stripe/Twilio/FCM/Maps/S3 keys — flagged per phase).
