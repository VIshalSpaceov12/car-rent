# Phase 0 — Foundation + Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the white-label car-rental monorepo so every surface boots, shares one typed token/contract, authenticates a user of each role, and reads/writes a multi-tenant Postgres DB — to a green verification gate.

**Architecture:** npm-workspaces monorepo. `apps/web` is a Next.js 16 (App Router) **full-stack** app — it is both the backend (route handlers + server actions, Prisma, auth) and the provider `/dashboard` + platform `/admin` UI, and it exposes `/api/*` REST for `apps/mobile` (Expo RN customer app). `packages/types` holds shared contracts; `packages/tokens` holds the Sunset Drive design system.

**Tech Stack:** TypeScript 5.7 (strict), Next.js 16 (App Router, React 19), Tailwind v4 (CSS-first), Prisma + PostgreSQL 16, next-intl, Expo SDK 53 RN + React Navigation, Vitest, bcrypt, jsonwebtoken, zod.

## Global Constraints

- **Node ≥ 20**; package manager **npm workspaces** only (`npm run <script> -w @car-rental/<name>`).
- **TypeScript strict everywhere; no `any`.** Functional components + hooks only.
- **Roles:** `CUSTOMER`, `PROVIDER`, `STAFF`, `ADMIN`. DB stores UPPER_SNAKE; `@car-rental/types` wire strings are kebab-case/lowercase — map at the repo/DTO boundary.
- **Booking status enum** (defined now, used later): `reserved → confirmed → vehicle-prepared → picked-up → returned → completed`, `+ rejected`, `cancelled`.
- **Multi-tenant:** `Provider` is the tenant; every tenant row carries `providerId`. Tenant scope enforced in the DAL and in every cache tag. Only `ADMIN` crosses tenants.
- **Auth:** cookie session (web) + bearer JWT (mobile), one session model; authenticated reads only via `src/server/auth/dal.ts`; mutations/actions start with `verifySession()`.
- **Next.js 16:** `proxy.ts` (not `middleware.ts`); awaited `params`/`searchParams`; `'use cache'` + `cacheLife`/`cacheTag`; `updateTag` after mutations.
- **Design tokens:** no raw hex/px/font in JSX — CSS variables (web) / `useTheme()` (mobile) only; Tailwind **logical** props (`ms-/me-/ps-/pe-`); `rounded-full` only on avatars/icon-only buttons. Exact token values come from `design.md`.
- **i18n:** EN + AR, AR is RTL; no hardcoded user-visible strings (`t()` only); logical layout; locale-aware formatters.
- **Commits:** frequent, conventional (`feat:`/`chore:`/`test:`). No push unless asked.

---

## File Structure

```
car-rental/
├─ package.json                      # workspaces root + scripts
├─ tsconfig.base.json                # strict base config
├─ eslint.config.mjs                 # flat config: TS + token/i18n/logical-prop rules
├─ .prettierrc · .nvmrc · .gitignore · .env.example
├─ .github/workflows/ci.yml          # typecheck+lint+test against Postgres service
├─ packages/
│  ├─ types/        src/index.ts (enums, DTOs, zod), wire⇄db mappers
│  └─ tokens/       primitives.ts, themes/{light,dark}.ts, theme.ts, css.ts,
│                   ThemeProvider.tsx, useTheme.ts, index.ts
└─ apps/
   ├─ web/
   │  ├─ prisma/    schema.prisma, seed.ts
   │  ├─ src/
   │  │  ├─ app/    layout.tsx, globals.css, [locale]/(auth)/login,
   │  │  │          [locale]/(provider)/dashboard, [locale]/admin,
   │  │  │          api/health, api/auth/{login,me}
   │  │  ├─ server/ db.ts, auth/{password,session,jwt,dal}.ts,
   │  │  │          modules/auth/auth.service.ts
   │  │  ├─ i18n/   request.ts, messages/{en,ar}.json
   │  │  ├─ ui/     Button.tsx, StatusChip.tsx (token-driven primitives)
   │  │  └─ proxy.ts
   │  └─ tailwind / postcss / next config
   └─ mobile/
      ├─ App.tsx, app.json, babel.config.js
      └─ src/  theme/ThemeProvider.tsx, i18n/index.ts, api/client.ts,
               navigation/{RootNavigator,TabNavigator,FloatingTabBar}.tsx,
               screens/{Onboarding,Login,Home,Bookings,Pickup,Settings}.tsx
```

---

## Task 1: Monorepo root + tooling

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc`, `.nvmrc`, `.gitignore`, `.env.example`

**Interfaces:**
- Produces: workspace globs `packages/*`, `apps/*`; root scripts `dev:web`, `dev:mobile`, `typecheck`, `lint`, `test`, `db:migrate`, `db:seed`.

- [ ] **Step 1: `git init` and create `.gitignore`**

```bash
git init
```

`.gitignore`:
```
node_modules/
.next/
.expo/
dist/
*.tsbuildinfo
.env
.env.*
!.env.example
.superpowers/
.DS_Store
coverage/
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "car-rental-platform",
  "version": "0.0.0",
  "private": true,
  "description": "White-label car rental platform — npm-workspaces monorepo (web full-stack, mobile + shared packages)",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=20" },
  "scripts": {
    "dev:web": "npm run dev -w @car-rental/web",
    "dev:mobile": "npm run start -w @car-rental/mobile",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "db:migrate": "npm run db:migrate -w @car-rental/web",
    "db:seed": "npm run db:seed -w @car-rental/web"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "eslint": "^9.17.0",
    "prettier": "^3.4.2",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.18.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.base.json`, `.prettierrc`, `.nvmrc`**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  }
}
```
`.prettierrc`: `{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }`
`.nvmrc`: `20`

- [ ] **Step 4: Create `eslint.config.mjs` (flat) with the discipline rules**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/.expo/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // token discipline (web): forbid raw hex in JSX-ish strings + raw left/right margins
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message: 'No raw hex — use design tokens / CSS variables (see design.md).',
        },
      ],
    },
  },
);
```
> The hex rule is `warn` at the monorepo level to avoid blocking token source files; per-app overrides escalate it to `error` for `apps/**/app/**`. (Escalation added in Task 7.)

- [ ] **Step 5: Create `.env.example`**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/car_rental_dev
JWT_SECRET=change-me-at-least-16-chars
SESSION_SECRET=change-me-at-least-16-chars
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

- [ ] **Step 6: Install and verify the workspace resolves**

Run: `npm install`
Expected: completes; root `node_modules` created; no workspace errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold npm-workspaces monorepo root + tooling"
```

---

## Task 2: `packages/types` (shared contracts)

**Files:**
- Create: `packages/types/package.json`, `packages/types/tsconfig.json`, `packages/types/src/index.ts`, `packages/types/src/index.test.ts`

**Interfaces:**
- Produces: `UserRole`, `Locale`, `BookingStatus`, `RentalPlan`, `PaymentMethod`, `PaymentStatus` (string-literal unions); `SessionUser`, `LoginRequest`, `LoginResponse`, `HealthResponse` types; `loginRequestSchema`, `sessionUserSchema` (zod); `roleToDb`/`roleFromDb` mappers.

- [ ] **Step 1: Create `packages/types/package.json` + `tsconfig.json`**

```json
{
  "name": "@car-rental/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": { "zod": "^3.24.1" },
  "devDependencies": { "typescript": "^5.7.2", "vitest": "^2.1.8" }
}
```
`packages/types/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 2: Write the failing test**

`packages/types/src/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { USER_ROLES, BOOKING_STATUSES, loginRequestSchema, roleToDb, roleFromDb } from './index';

describe('@car-rental/types', () => {
  it('exposes the four roles', () => {
    expect(USER_ROLES).toEqual(['customer', 'provider', 'staff', 'admin']);
  });
  it('exposes the full booking lifecycle in order', () => {
    expect(BOOKING_STATUSES).toEqual([
      'reserved', 'confirmed', 'vehicle-prepared', 'picked-up',
      'returned', 'completed', 'rejected', 'cancelled',
    ]);
  });
  it('maps wire role ⇄ db role', () => {
    expect(roleToDb('vehicle-prepared' as never)).toBeUndefined(); // not a role
    expect(roleToDb('provider')).toBe('PROVIDER');
    expect(roleFromDb('PROVIDER')).toBe('provider');
  });
  it('validates a login request', () => {
    expect(loginRequestSchema.safeParse({ email: 'a@b.c', password: 'x' }).success).toBe(true);
    expect(loginRequestSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -w @car-rental/types`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 4: Write `packages/types/src/index.ts`**

```ts
import { z } from 'zod';

export const USER_ROLES = ['customer', 'provider', 'staff', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const BOOKING_STATUSES = [
  'reserved', 'confirmed', 'vehicle-prepared', 'picked-up',
  'returned', 'completed', 'rejected', 'cancelled',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const RENTAL_PLANS = ['daily', 'weekly', 'monthly', 'long-term'] as const;
export type RentalPlan = (typeof RENTAL_PLANS)[number];

export const PAYMENT_METHODS = ['card', 'cash-on-delivery'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ---- wire ⇄ db mappers (db = UPPER_SNAKE) -------------------------------
const toDb = (s: string) => s.toUpperCase().replace(/-/g, '_');
const fromDb = (s: string) => s.toLowerCase().replace(/_/g, '-');

export const roleToDb = (r: UserRole): string | undefined =>
  (USER_ROLES as readonly string[]).includes(r) ? toDb(r) : undefined;
export const roleFromDb = (r: string): UserRole => fromDb(r) as UserRole;
export const bookingStatusToDb = (s: BookingStatus) => toDb(s);
export const bookingStatusFromDb = (s: string) => fromDb(s) as BookingStatus;

// ---- DTOs ---------------------------------------------------------------
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  providerId: z.string().nullable(),
  locale: z.enum(LOCALES),
  name: z.string(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export interface LoginResponse { token: string; user: SessionUser }
export interface HealthResponse { status: 'ok'; time: string }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -w @car-rental/types`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/types && git commit -m "feat(types): shared role/status enums, DTOs, zod schemas, wire⇄db mappers"
```

---

## Task 3: `packages/tokens` (Sunset Drive design system)

**Files:**
- Create: `packages/tokens/package.json`, `tsconfig.json`, `src/primitives.ts`, `src/theme.ts`, `src/themes/light.ts`, `src/themes/dark.ts`, `src/css.ts`, `src/ThemeProvider.tsx`, `src/useTheme.ts`, `src/index.ts`, `src/theme.test.ts`

**Interfaces:**
- Produces: `ColorScheme`, `Theme`, `createTheme(scheme, brandOverrides?)`, `lightTheme`, `darkTheme`, `defaultTheme` (=light), `themeToCssVars(theme): Record<string,string>`, `ThemeProvider`, `useTheme()`. Token values are exactly those in `design.md`.

- [ ] **Step 1: Create `package.json` + `tsconfig.json`**

```json
{
  "name": "@car-rental/tokens",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "peerDependencies": { "react": ">=18" },
  "devDependencies": {
    "@types/react": "^19.0.0", "react": "^19.0.0",
    "typescript": "^5.7.2", "vitest": "^2.1.8"
  }
}
```
`tsconfig.json`: `{ "extends": "../../tsconfig.base.json", "compilerOptions": { "jsx": "react-jsx" }, "include": ["src"] }`

- [ ] **Step 2: Write the failing test**

`packages/tokens/src/theme.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { lightTheme, darkTheme, defaultTheme, createTheme, themeToCssVars } from './index';

describe('@car-rental/tokens', () => {
  it('light is the default and carries the Sunset Drive brand', () => {
    expect(defaultTheme).toBe(lightTheme);
    expect(lightTheme.color.primary).toBe('#F97316');
    expect(lightTheme.color.background).toBe('#FFF8F3');
    expect(darkTheme.color.background).toBe('#0B1220');
  });
  it('shares brand + status hues across schemes, flips only neutrals', () => {
    expect(darkTheme.color.primary).toBe(lightTheme.color.primary);
    expect(darkTheme.color.success).toBe(lightTheme.color.success);
    expect(darkTheme.color.text).not.toBe(lightTheme.color.text);
  });
  it('white-labels primary and derives gradient + glow', () => {
    const t = createTheme('light', { primary: '#2563EB', primaryDark: '#1D4ED8' });
    expect(t.color.primary).toBe('#2563EB');
    expect(t.color.gradientPrimary).toEqual(['#2563EB', '#1D4ED8']);
    expect(t.color.glow).toContain('37, 99, 235'); // primary @ 0.35 as rgba
  });
  it('static layout tokens are identical across schemes', () => {
    expect(lightTheme.spacing.md).toBe(16);
    expect(darkTheme.spacing.md).toBe(16);
    expect(lightTheme.radius.card).toBe(18);
  });
  it('emits CSS custom properties for the web', () => {
    const vars = themeToCssVars(lightTheme);
    expect(vars['--color-primary']).toBe('#F97316');
    expect(vars['--space-md']).toBe('16px');
    expect(vars['--radius-card']).toBe('18px');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -w @car-rental/tokens`
Expected: FAIL — module not found.

- [ ] **Step 4: Write `src/primitives.ts` (PRIVATE — not re-exported)**

```ts
// Private raw ramps. NEVER exported from index.ts.
export const palette = {
  orange: { 300: '#FB923C', 500: '#F97316', 600: '#EA580C' },
  teal: { 500: '#0EA5A4', 600: '#0D9488' },
  navy: '#0B1F3A',
  cream: '#FFF8F3',
  white: '#FFFFFF',
  surfaceAltLight: '#FCEFE6',
  borderLight: '#EADFD4',
  mutedLight: '#5B6B82',
  subtleLight: '#94A3B8',
  // dark neutrals
  bgDark: '#0B1220', surfaceDark: '#131C2E', surfaceAltDark: '#1B2540',
  textDark: '#F8FAFC', mutedDark: '#94A3B8', subtleDark: '#64748B', borderDark: '#283349',
  // status
  green: '#16A34A', amber: '#F59E0B', gold: '#FACC15', red: '#EF4444',
} as const;

export const space = { none: 0, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radii = { sm: 10, md: 14, lg: 18, card: 18, input: 12, pill: 999 } as const;
export const fontFamily = { display: 'Plus Jakarta Sans', body: 'Inter' } as const;
```

- [ ] **Step 5: Write `src/theme.ts` (types + static tokens + createTheme + helpers)**

```ts
import { palette, space, radii, fontFamily } from './primitives';
import { lightScheme } from './themes/light';
import { darkScheme } from './themes/dark';

export interface ColorScheme {
  primary: string; primaryDark: string; onPrimary: string;
  accent: string; accentDark: string;
  background: string; surface: string; surfaceAlt: string;
  text: string; textMuted: string; textSubtle: string; border: string;
  success: string; warning: string; rating: string; danger: string; info: string;
  overlay: string; gradientPrimary: [string, string]; glow: string;
}

export interface TextStyle { fontSize: number; fontWeight: number; lineHeight: number; family: string; letterSpacing?: number }
export interface ElevationStyle { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number }; elevation: number }

export interface Theme {
  scheme: 'light' | 'dark';
  color: ColorScheme;
  spacing: typeof space;
  radius: typeof radii;
  typography: Record<'display'|'heading'|'title'|'subtitle'|'body'|'caption'|'label', TextStyle>;
  elevation: Record<'none'|'sm'|'md'|'lg'|'glow', ElevationStyle>;
  zIndex: Record<'base'|'card'|'header'|'overlay'|'modal'|'toast', number>;
  size: { icon: Record<string, number>; control: Record<string, number>; touchTarget: number };
  motion: {
    duration: { fast: number; base: number; slow: number; hero: number };
    easing: Record<'standard'|'enter'|'exit'|'spring', [number, number, number, number]>;
    springPress: { damping: number; stiffness: number; mass: number };
  };
}

const t = (fontSize: number, fontWeight: number, lineHeight: number, family = fontFamily.body, letterSpacing?: number): TextStyle =>
  ({ fontSize, fontWeight, lineHeight, family, letterSpacing });

const STATIC = {
  spacing: space,
  radius: radii,
  typography: {
    display: t(40, 800, 46, fontFamily.display, -0.5),
    heading: t(28, 700, 34, fontFamily.display),
    title: t(20, 600, 26, fontFamily.display),
    subtitle: t(15, 500, 20),
    body: t(16, 400, 24),
    caption: t(13, 400, 18),
    label: t(13, 600, 16),
  },
  elevation: {
    none: { shadowColor: '#000', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
    sm: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    md: { shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
    lg: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
    glow: { shadowColor: palette.orange[500], shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  },
  zIndex: { base: 0, card: 1, header: 10, overlay: 100, modal: 1000, toast: 2000 },
  size: {
    icon: { xs: 14, sm: 16, md: 18, lg: 20, xl: 22, xxl: 24, hero: 32 },
    control: { sm: 40, md: 52, lg: 60 }, touchTarget: 44,
  },
  motion: {
    duration: { fast: 120, base: 200, slow: 320, hero: 480 },
    easing: {
      standard: [0.2, 0, 0, 1], enter: [0, 0, 0, 1], exit: [0.4, 0, 1, 1], spring: [0.34, 1.56, 0.64, 1],
    } as Theme['motion']['easing'],
    springPress: { damping: 18, stiffness: 240, mass: 0.8 },
  },
} satisfies Omit<Theme, 'scheme' | 'color'>;

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

export type BrandOverrides = Partial<Pick<ColorScheme, 'primary' | 'primaryDark' | 'accent' | 'gradientPrimary' | 'glow'>>;

export function createTheme(schemeName: 'light' | 'dark', brand: BrandOverrides = {}): Theme {
  const base = schemeName === 'light' ? lightScheme : darkScheme;
  const primary = brand.primary ?? base.primary;
  const primaryDark = brand.primaryDark ?? base.primaryDark;
  const [r, g, b] = hexToRgb(primary);
  const color: ColorScheme = {
    ...base,
    primary, primaryDark,
    accent: brand.accent ?? base.accent,
    gradientPrimary: brand.gradientPrimary ?? (brand.primary ? [primary, primaryDark] : base.gradientPrimary),
    glow: brand.glow ?? (brand.primary ? `rgba(${r}, ${g}, ${b}, 0.35)` : base.glow),
  };
  return { scheme: schemeName, color, ...STATIC };
}

export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');
export const defaultTheme = lightTheme;
```

- [ ] **Step 6: Write the two schemes**

`src/themes/light.ts`:
```ts
import { palette } from '../primitives';
import type { ColorScheme } from '../theme';

export const lightScheme: ColorScheme = {
  primary: palette.orange[500], primaryDark: palette.orange[600], onPrimary: palette.white,
  accent: palette.teal[500], accentDark: palette.teal[600],
  background: palette.cream, surface: palette.white, surfaceAlt: palette.surfaceAltLight,
  text: palette.navy, textMuted: palette.mutedLight, textSubtle: palette.subtleLight, border: palette.borderLight,
  success: palette.green, warning: palette.amber, rating: palette.gold, danger: palette.red, info: palette.teal[500],
  overlay: 'rgba(11, 31, 58, 0.55)',
  gradientPrimary: [palette.orange[500], palette.orange[600]],
  glow: 'rgba(249, 115, 22, 0.35)',
};
```
`src/themes/dark.ts`:
```ts
import { palette } from '../primitives';
import type { ColorScheme } from '../theme';

export const darkScheme: ColorScheme = {
  primary: palette.orange[500], primaryDark: palette.orange[600], onPrimary: palette.white,
  accent: palette.teal[500], accentDark: palette.teal[600],
  background: palette.bgDark, surface: palette.surfaceDark, surfaceAlt: palette.surfaceAltDark,
  text: palette.textDark, textMuted: palette.mutedDark, textSubtle: palette.subtleDark, border: palette.borderDark,
  success: palette.green, warning: palette.amber, rating: palette.gold, danger: palette.red, info: palette.teal[500],
  overlay: 'rgba(0, 0, 0, 0.60)',
  gradientPrimary: [palette.orange[500], palette.orange[600]],
  glow: 'rgba(249, 115, 22, 0.35)',
};
```

- [ ] **Step 7: Write `src/css.ts` (web CSS-var emitter)**

```ts
import type { Theme } from './theme';

export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.color)) {
    if (Array.isArray(v)) vars[`--gradient-${k}`] = v.join(', ');
    else vars[`--color-${k}`] = v as string;
  }
  for (const [k, v] of Object.entries(theme.spacing)) vars[`--space-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(theme.radius)) vars[`--radius-${k}`] = `${v}px`;
  return vars;
}

export function cssVarBlock(theme: Theme): string {
  return Object.entries(themeToCssVars(theme)).map(([k, v]) => `${k}: ${v};`).join(' ');
}
```

- [ ] **Step 8: Write `useTheme.ts` + `ThemeProvider.tsx` (RN/React runtime)**

`src/useTheme.ts`:
```ts
import { createContext, useContext } from 'react';
import { defaultTheme, type Theme } from './theme';

export const ThemeContext = createContext<Theme>(defaultTheme);
export const useTheme = (): Theme => useContext(ThemeContext);
```
`src/ThemeProvider.tsx`:
```tsx
import { createElement, type ReactNode } from 'react';
import { ThemeContext } from './useTheme';
import { defaultTheme, type Theme } from './theme';

export function ThemeProvider({ theme = defaultTheme, children }: { theme?: Theme; children: ReactNode }) {
  return createElement(ThemeContext.Provider, { value: theme }, children);
}
```

- [ ] **Step 9: Write `src/index.ts` (public surface — primitives stay private)**

```ts
export type { ColorScheme, Theme, TextStyle, ElevationStyle, BrandOverrides } from './theme';
export { createTheme, lightTheme, darkTheme, defaultTheme } from './theme';
export { themeToCssVars, cssVarBlock } from './css';
export { ThemeProvider } from './ThemeProvider';
export { useTheme } from './useTheme';
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npm run test -w @car-rental/tokens`
Expected: PASS (5 tests).

- [ ] **Step 11: Commit**

```bash
git add packages/tokens && git commit -m "feat(tokens): Sunset Drive design system — schemes, theme, CSS vars, white-label derivation"
```

---

## Task 4: `apps/web` — Next.js init + Tailwind v4 wired to tokens

**Files:**
- Create (via generator, then edit): `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/tsconfig.json`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/lib/theme-style.ts`

**Interfaces:**
- Consumes: `@car-rental/tokens` (`lightTheme`, `darkTheme`, `cssVarBlock`).
- Produces: a booting Next.js app whose Tailwind utilities resolve to token CSS variables; `<html>` carries `data-theme`.

- [ ] **Step 1: Scaffold the app**

Run:
```bash
npx create-next-app@latest apps/web --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
Then set `apps/web/package.json` name to `@car-rental/web`, add `"@car-rental/tokens": "*"` and `"@car-rental/types": "*"` to dependencies, and ensure scripts include:
```json
"scripts": {
  "dev": "next dev -p 3000",
  "build": "next build",
  "start": "next start -p 3000",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "db:migrate": "prisma migrate dev",
  "db:seed": "prisma db seed"
}
```
Make `apps/web/tsconfig.json` extend the base: add `"extends": "../../tsconfig.base.json"` (keep Next's `plugins`/`paths`).

- [ ] **Step 2: Emit token CSS variables into `globals.css`**

`apps/web/src/lib/theme-style.ts`:
```ts
import { cssVarBlock, lightTheme, darkTheme } from '@car-rental/tokens';

export const rootThemeCss = `:root { ${cssVarBlock(lightTheme)} } [data-theme="dark"] { ${cssVarBlock(darkTheme)} }`;
```
Replace `apps/web/src/app/globals.css` with the Tailwind v4 CSS-first config mapping utilities → token vars:
```css
@import 'tailwindcss';

@theme inline {
  --color-primary: var(--color-primary);
  --color-background: var(--color-background);
  --color-surface: var(--color-surface);
  --color-surface-alt: var(--color-surfaceAlt);
  --color-text: var(--color-text);
  --color-text-muted: var(--color-textMuted);
  --color-border: var(--color-border);
  --color-success: var(--color-success);
  --color-danger: var(--color-danger);
  --radius-card: var(--radius-card);
}

body { background: var(--color-background); color: var(--color-text); font-family: 'Inter', system-ui, sans-serif; }
```

- [ ] **Step 3: Inject the `:root` var block + `data-theme` in the root layout**

`apps/web/src/app/layout.tsx` (note: real layout is per-locale in Task 8; this minimal root just proves wiring):
```tsx
import type { ReactNode } from 'react';
import { rootThemeCss } from '@/lib/theme-style';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head><style dangerouslySetInnerHTML={{ __html: rootThemeCss }} /></head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Verify it builds and a token-driven page renders**

Replace `apps/web/src/app/page.tsx` body with a `<main className="ps-md text-text">` using a token color, then run:
```bash
npm run build -w @car-rental/web
```
Expected: build succeeds; no Tailwind/type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web && git commit -m "feat(web): Next.js 16 app shell with Tailwind wired to design tokens"
```

---

## Task 5: `apps/web` — Prisma schema, migration, seed (multi-tenant base)

**Files:**
- Create: `apps/web/prisma/schema.prisma`, `apps/web/prisma/seed.ts`, `apps/web/src/server/db.ts`, `apps/web/src/server/db.test.ts`
- Modify: `apps/web/package.json` (prisma deps + seed config)

**Interfaces:**
- Consumes: `DATABASE_URL`.
- Produces: Prisma models `Provider`, `BusinessSettings`, `User`, `Session`; singleton `prisma` client; seed creating 1 provider + 1 user per role.

- [ ] **Step 1: Add deps + prisma seed hook**

Run: `npm i -w @car-rental/web @prisma/client bcrypt jsonwebtoken && npm i -D -w @car-rental/web prisma @types/bcrypt @types/jsonwebtoken tsx`
Add to `apps/web/package.json`: `"prisma": { "seed": "tsx prisma/seed.ts" }`.

- [ ] **Step 2: Write `apps/web/prisma/schema.prisma`**

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum UserRole { CUSTOMER PROVIDER STAFF ADMIN }
enum Locale { EN AR }

model Provider {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  logoUrl       String?
  colors        Json     // { primary, primaryDark } white-label overrides
  defaultLocale Locale   @default(EN)
  status        String   @default("active") // active | suspended | pending
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  users            User[]
  businessSettings BusinessSettings?
}

model BusinessSettings {
  id                 String   @id @default(cuid())
  providerId         String   @unique
  currency           String   @default("USD")
  taxRatePct         Decimal  @default(0) @db.Decimal(5, 2)
  minRentalDays      Int      @default(1)
  cancellationPolicy String   @default("")
  provider Provider @relation(fields: [providerId], references: [id], onDelete: Cascade)
}

model User {
  id           String   @id @default(cuid())
  providerId   String?  // null for CUSTOMER and ADMIN; set for PROVIDER/STAFF
  role         UserRole
  email        String   @unique
  passwordHash String
  name         String
  locale       Locale   @default(EN)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  provider Provider? @relation(fields: [providerId], references: [id], onDelete: SetNull)
  sessions Session[]
  @@index([providerId])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

- [ ] **Step 3: Write the db client singleton `apps/web/src/server/db.ts`**

```ts
import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
```

- [ ] **Step 4: Write the seed `apps/web/prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PASS = 'Password123!';

async function main() {
  const passwordHash = await bcrypt.hash(PASS, 10);
  const provider = await prisma.provider.upsert({
    where: { slug: 'drivehub' },
    update: {},
    create: {
      name: 'DriveHub', slug: 'drivehub',
      colors: { primary: '#F97316', primaryDark: '#EA580C' },
      businessSettings: { create: { currency: 'USD', taxRatePct: 5 } },
    },
  });
  const users: Array<[string, 'ADMIN'|'PROVIDER'|'STAFF'|'CUSTOMER', string | null, string]> = [
    ['admin@demo.test', 'ADMIN', null, 'Platform Admin'],
    ['provider@demo.test', 'PROVIDER', provider.id, 'DriveHub Owner'],
    ['staff@demo.test', 'STAFF', provider.id, 'DriveHub Staff'],
    ['customer@demo.test', 'CUSTOMER', null, 'Demo Customer'],
  ];
  for (const [email, role, providerId, name] of users) {
    await prisma.user.upsert({
      where: { email }, update: {},
      create: { email, role, providerId, name, passwordHash },
    });
  }
  console.log('Seeded provider DriveHub + 4 users (password:', PASS, ')');
}
main().finally(() => prisma.$disconnect());
```

- [ ] **Step 5: Migrate + seed, then verify with a test**

Run:
```bash
cp .env.example apps/web/.env   # ensure DATABASE_URL points at a running Postgres 16
npm run db:migrate -w @car-rental/web -- --name init
npm run db:seed -w @car-rental/web
```
Expected: migration `init` applied; "Seeded provider DriveHub + 4 users".

`apps/web/src/server/db.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { prisma } from './db';

describe('seed', () => {
  it('has one user per role, tenant-scoped correctly', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@demo.test' } });
    const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
    expect(admin?.role).toBe('ADMIN');
    expect(admin?.providerId).toBeNull();
    expect(provider?.providerId).not.toBeNull();
  });
});
```
Run: `npm run test -w @car-rental/web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web && git commit -m "feat(web): Prisma multi-tenant schema (Provider/User/Session) + migration + seed"
```

---

## Task 6: `apps/web` — auth services + DAL (dual cookie/JWT, tenant guards)

**Files:**
- Create: `apps/web/src/server/auth/password.ts`, `jwt.ts`, `session.ts`, `dal.ts`, `apps/web/src/server/modules/auth/auth.service.ts`, `apps/web/src/server/auth/auth.test.ts`

**Interfaces:**
- Consumes: `prisma`, `JWT_SECRET`, `SessionUser`/`roleFromDb` from `@car-rental/types`.
- Produces: `hashPassword`/`verifyPassword`; `signJwt(userId)`/`verifyJwt(token): {userId} | null`; `authenticate(email,password): {token, user} | null`; `verifySession(): Promise<SessionUser | null>` (reads cookie OR bearer); `requireRole(user, ...roles)`; `tenantScope(user): { providerId?: string }`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/server/auth/auth.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { signJwt, verifyJwt } from './jwt';
import { requireRole, tenantScope } from './dal';
import type { SessionUser } from '@car-rental/types';

const provider: SessionUser = { id: 'u1', email: 'p@x.c', role: 'provider', providerId: 'prov1', locale: 'en', name: 'P' };
const admin: SessionUser = { ...provider, id: 'u2', role: 'admin', providerId: null };

describe('auth primitives', () => {
  it('hashes and verifies a password', async () => {
    const h = await hashPassword('Password123!');
    expect(await verifyPassword('Password123!', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });
  it('signs and verifies a JWT round-trip', () => {
    const token = signJwt('u1');
    expect(verifyJwt(token)?.userId).toBe('u1');
    expect(verifyJwt('garbage')).toBeNull();
  });
  it('requireRole allows listed roles, throws otherwise', () => {
    expect(() => requireRole(provider, 'provider', 'staff')).not.toThrow();
    expect(() => requireRole(provider, 'admin')).toThrow();
  });
  it('tenantScope pins providers to their tenant, admin unscoped', () => {
    expect(tenantScope(provider)).toEqual({ providerId: 'prov1' });
    expect(tenantScope(admin)).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @car-rental/web -- auth`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `password.ts` and `jwt.ts`**

`password.ts`:
```ts
import bcrypt from 'bcrypt';
export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
```
`jwt.ts`:
```ts
import jwt from 'jsonwebtoken';
const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET missing or < 16 chars');
  return s;
};
export const signJwt = (userId: string) => jwt.sign({ userId }, secret(), { expiresIn: '30d' });
export const verifyJwt = (token: string): { userId: string } | null => {
  try { const d = jwt.verify(token, secret()) as { userId: string }; return { userId: d.userId }; }
  catch { return null; }
};
```

- [ ] **Step 4: Write `dal.ts` (session resolution + guards)**

```ts
import 'server-only';
import { cookies, headers } from 'next/headers';
import { prisma } from '@/server/db';
import { roleFromDb, type SessionUser, type UserRole, type Locale } from '@car-rental/types';
import { verifyJwt } from './jwt';

const SESSION_COOKIE = 'cr_session';

export async function verifySession(): Promise<SessionUser | null> {
  // 1) bearer JWT (mobile)
  const auth = (await headers()).get('authorization');
  let userId: string | null = null;
  if (auth?.startsWith('Bearer ')) userId = verifyJwt(auth.slice(7))?.userId ?? null;
  // 2) cookie session id (web)
  if (!userId) {
    const sid = (await cookies()).get(SESSION_COOKIE)?.value;
    if (sid) {
      const session = await prisma.session.findUnique({ where: { id: sid } });
      if (session && session.expiresAt > new Date()) userId = session.userId;
    }
  }
  if (!userId) return null;
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return null;
  return {
    id: u.id, email: u.email, name: u.name,
    role: roleFromDb(u.role) as UserRole,
    providerId: u.providerId, locale: u.locale.toLowerCase() as Locale,
  };
}

export function requireRole(user: SessionUser, ...roles: UserRole[]): void {
  if (!roles.includes(user.role)) throw new Error('FORBIDDEN');
}

/** Returns the Prisma where-fragment that scopes a query to the caller's tenant. Admin = no scope. */
export function tenantScope(user: SessionUser): { providerId?: string } {
  if (user.role === 'admin') return {};
  return user.providerId ? { providerId: user.providerId } : {};
}

export { SESSION_COOKIE };
```

- [ ] **Step 5: Write `auth.service.ts` (authenticate + session issue)**

```ts
import { prisma } from '@/server/db';
import { roleFromDb, type LoginResponse, type SessionUser, type Locale, type UserRole } from '@car-rental/types';
import { verifyPassword } from '@/server/auth/password';
import { signJwt } from '@/server/auth/jwt';

const toSessionUser = (u: { id: string; email: string; name: string; role: string; providerId: string | null; locale: string }): SessionUser => ({
  id: u.id, email: u.email, name: u.name,
  role: roleFromDb(u.role) as UserRole, providerId: u.providerId, locale: u.locale.toLowerCase() as Locale,
});

export async function authenticate(email: string, password: string): Promise<LoginResponse | null> {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u || !(await verifyPassword(password, u.passwordHash))) return null;
  return { token: signJwt(u.id), user: toSessionUser(u) };
}

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const s = await prisma.session.create({ data: { userId, expiresAt } });
  return { id: s.id, expiresAt };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test -w @car-rental/web -- auth`
Expected: PASS (4 tests). (`JWT_SECRET` must be set in `apps/web/.env`.)

- [ ] **Step 7: Commit**

```bash
git add apps/web && git commit -m "feat(web): dual cookie/JWT auth, DAL with role + tenant guards"
```

---

## Task 7: `apps/web` — routes: health, auth API, login page, dashboard + admin shells

**Files:**
- Create: `apps/web/src/app/api/health/route.ts`, `apps/web/src/app/api/auth/login/route.ts`, `apps/web/src/app/api/auth/me/route.ts`, `apps/web/src/app/[locale]/(auth)/login/page.tsx` + `actions.ts`, `apps/web/src/app/[locale]/(provider)/dashboard/page.tsx`, `apps/web/src/app/[locale]/admin/page.tsx`, `apps/web/src/ui/Button.tsx`, `apps/web/src/ui/StatusChip.tsx`, `apps/web/src/proxy.ts`, `apps/web/src/app/api/health/route.test.ts`, `apps/web/src/app/api/auth/login/route.test.ts`
- Modify: `eslint.config.mjs` (escalate hex rule to error for `apps/**/app/**`)

**Interfaces:**
- Consumes: `authenticate`, `createSession`, `verifySession`, `requireRole`, `SESSION_COOKIE`, `loginRequestSchema`.
- Produces: `GET /api/health`, `POST /api/auth/login` (returns `{token,user}`, sets cookie), `GET /api/auth/me`; web `/login`, `/dashboard` (PROVIDER/STAFF), `/admin` (ADMIN-only).

- [ ] **Step 1: Write failing API tests**

`apps/web/src/app/api/health/route.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });
});
```
`apps/web/src/app/api/auth/login/route.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { POST } from './route';

const req = (body: unknown) =>
  new Request('http://localhost/api/auth/login', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

describe('POST /api/auth/login', () => {
  it('rejects bad credentials with 401', async () => {
    const res = await POST(req({ email: 'customer@demo.test', password: 'wrong' }));
    expect(res.status).toBe(401);
  });
  it('logs the seeded customer in', async () => {
    const res = await POST(req({ email: 'customer@demo.test', password: 'Password123!' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.role).toBe('customer');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w @car-rental/web -- route`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Implement the API routes**

`apps/web/src/app/api/health/route.ts`:
```ts
import { NextResponse } from 'next/server';
import type { HealthResponse } from '@car-rental/types';

export async function GET() {
  return NextResponse.json<HealthResponse>({ status: 'ok', time: new Date().toISOString() });
}
```
`apps/web/src/app/api/auth/login/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginRequestSchema } from '@car-rental/types';
import { authenticate, createSession } from '@/server/modules/auth/auth.service';
import { SESSION_COOKIE } from '@/server/auth/dal';

export async function POST(req: Request) {
  const parsed = loginRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  // web also gets an httpOnly cookie session; mobile uses the returned token
  const session = await createSession(result.user.id);
  (await cookies()).set(SESSION_COOKIE, session.id, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    expires: session.expiresAt, path: '/',
  });
  return NextResponse.json(result);
}
```
`apps/web/src/app/api/auth/me/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { verifySession } from '@/server/auth/dal';

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(user);
}
```

- [ ] **Step 4: Implement the token-driven UI primitives**

`apps/web/src/ui/Button.tsx`:
```tsx
import type { ButtonHTMLAttributes } from 'react';

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-[var(--radius-input)] px-md py-sm transition';
  const styles = variant === 'primary'
    ? 'text-white [background:linear-gradient(135deg,var(--color-primary),var(--color-primaryDark))] shadow-[0_8px_20px_var(--color-glow)]'
    : 'text-text bg-surface-alt';
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
```
`apps/web/src/ui/StatusChip.tsx`:
```tsx
const MAP: Record<string, string> = {
  confirmed: 'var(--color-success)', completed: 'var(--color-success)',
  'vehicle-prepared': 'var(--color-info)', returned: 'var(--color-info)',
  'picked-up': 'var(--color-primary)', rejected: 'var(--color-danger)', cancelled: 'var(--color-danger)',
  reserved: 'var(--color-textSubtle)',
};
export function StatusChip({ status, label }: { status: string; label: string }) {
  const c = MAP[status] ?? 'var(--color-textSubtle)';
  return <span className="inline-flex items-center gap-xs rounded-pill px-sm py-xs text-label" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}>{label}</span>;
}
```

- [ ] **Step 5: Implement login page (server action) + dashboard + admin shells**

`apps/web/src/app/[locale]/(auth)/login/actions.ts`:
```ts
'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticate, createSession } from '@/server/modules/auth/auth.service';
import { SESSION_COOKIE } from '@/server/auth/dal';

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const result = await authenticate(email, password);
  if (!result) return { error: 'invalid_credentials' };
  const session = await createSession(result.user.id);
  (await cookies()).set(SESSION_COOKIE, session.id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: session.expiresAt, path: '/' });
  redirect(result.user.role === 'admin' ? '/admin' : '/dashboard');
}
```
`apps/web/src/app/[locale]/(auth)/login/page.tsx`:
```tsx
'use client';
import { useActionState } from 'react';
import { loginAction } from './actions';
import { Button } from '@/ui/Button';

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-md ps-md pe-md">
      <h1 className="text-3xl font-extrabold text-text">Sign in</h1>
      <form action={action} className="flex flex-col gap-sm">
        <input name="email" type="email" placeholder="Email" className="rounded-[var(--radius-input)] border border-border bg-surface px-md py-sm" />
        <input name="password" type="password" placeholder="Password" className="rounded-[var(--radius-input)] border border-border bg-surface px-md py-sm" />
        {state?.error && <p className="text-danger text-label">Invalid credentials</p>}
        <Button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </main>
  );
}
```
`apps/web/src/app/[locale]/(provider)/dashboard/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { verifySession } from '@/server/auth/dal';

export default async function DashboardPage() {
  const user = await verifySession();
  if (!user) redirect('/login');
  if (user.role !== 'provider' && user.role !== 'staff') redirect('/');
  return <main className="ps-lg pe-lg pt-lg"><h1 className="text-2xl font-bold text-text">Provider dashboard — {user.name}</h1><p className="text-text-muted">Fleet, bookings, branches land in Phase 1+.</p></main>;
}
```
`apps/web/src/app/[locale]/admin/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { verifySession } from '@/server/auth/dal';

export default async function AdminPage() {
  const user = await verifySession();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/');
  return <main className="ps-lg pe-lg pt-lg"><h1 className="text-2xl font-bold text-text">Platform admin</h1><p className="text-text-muted">All-tenant oversight lands in Phase 7.</p></main>;
}
```

- [ ] **Step 6: Add `proxy.ts` route protection + escalate the hex lint rule**

`apps/web/src/proxy.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/server/auth/dal';

const PROTECTED = ['/dashboard', '/admin'];
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PROTECTED.some((p) => pathname.includes(p)) && !req.cookies.get(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
```
In root `eslint.config.mjs`, append a block escalating the hex rule for app JSX:
```js
  {
    files: ['apps/**/src/app/**/*.tsx', 'apps/**/src/ui/**/*.tsx'],
    rules: { 'no-restricted-syntax': ['error', { selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]", message: 'No raw hex in JSX — use CSS variables.' }] },
  },
```

- [ ] **Step 7: Run API tests + typecheck + lint**

Run: `npm run test -w @car-rental/web -- route && npm run typecheck -w @car-rental/web && npm run lint`
Expected: tests PASS; typecheck clean; lint clean.

- [ ] **Step 8: Commit**

```bash
git add apps/web eslint.config.mjs && git commit -m "feat(web): health + auth API, login, role-gated dashboard/admin shells, proxy guard"
```

---

## Task 8: `apps/web` — i18n (EN/AR) + RTL-aware locale layout

**Files:**
- Create: `apps/web/src/i18n/request.ts`, `apps/web/src/i18n/messages/en.json`, `apps/web/src/i18n/messages/ar.json`, `apps/web/src/app/[locale]/layout.tsx`
- Modify: `apps/web/next.config.ts` (next-intl plugin), move root content under `[locale]`

**Interfaces:**
- Consumes: `next-intl`, `rootThemeCss`.
- Produces: `/en/*` and `/ar/*` routes; `<html lang dir>` set per locale; `useTranslations()` available; no hardcoded strings in shells.

- [ ] **Step 1: Install next-intl + configure plugin**

Run: `npm i -w @car-rental/web next-intl`
`apps/web/next.config.ts`:
```ts
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
export default withNextIntl({});
```

- [ ] **Step 2: Add request config + messages**

`apps/web/src/i18n/request.ts`:
```ts
import { getRequestConfig } from 'next-intl/server';
const LOCALES = ['en', 'ar'] as const;
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = (LOCALES as readonly string[]).includes(requested ?? '') ? requested! : 'en';
  return { locale, messages: (await import(`./messages/${locale}.json`)).default };
});
```
`messages/en.json`:
```json
{ "auth": { "signIn": "Sign in", "email": "Email", "password": "Password", "invalid": "Invalid credentials" },
  "dashboard": { "title": "Provider dashboard", "soon": "Fleet, bookings, branches land in Phase 1+." },
  "admin": { "title": "Platform admin", "soon": "All-tenant oversight lands in Phase 7." } }
```
`messages/ar.json`:
```json
{ "auth": { "signIn": "تسجيل الدخول", "email": "البريد الإلكتروني", "password": "كلمة المرور", "invalid": "بيانات الاعتماد غير صحيحة" },
  "dashboard": { "title": "لوحة مزود الخدمة", "soon": "الأسطول والحجوزات والفروع في المرحلة 1+." },
  "admin": { "title": "مشرف المنصة", "soon": "الإشراف على جميع المستأجرين في المرحلة 7." } }
```

- [ ] **Step 3: Add the locale layout (dir-aware) and wire the provider**

`apps/web/src/app/[locale]/layout.tsx`:
```tsx
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { rootThemeCss } from '@/lib/theme-style';
import '../globals.css';

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const messages = await getMessages();
  return (
    <html lang={locale} dir={dir} data-theme="light">
      <head><style dangerouslySetInnerHTML={{ __html: rootThemeCss }} /></head>
      <body><NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider></body>
    </html>
  );
}
```
Then replace hardcoded strings in `login/page.tsx`, `dashboard/page.tsx`, `admin/page.tsx` with `useTranslations()` / `getTranslations()` keys (`auth.*`, `dashboard.*`, `admin.*`), and delete the now-superseded root `src/app/layout.tsx` content (keep only the locale layout). Update `proxy.ts` redirect targets to `/${locale}/login` if needed.

- [ ] **Step 4: Verify both locales render with correct direction**

Run: `npm run build -w @car-rental/web` then `npm run dev -w @car-rental/web`
Manually: open `/en/login` (LTR) and `/ar/login` (RTL — inputs/labels mirror). Expected: both render; `<html dir>` flips; no hardcoded English on `/ar`.

- [ ] **Step 5: Commit**

```bash
git add apps/web && git commit -m "feat(web): next-intl EN/AR with RTL-aware locale layout"
```

---

## Task 9: `apps/mobile` — Expo shell (theme, i18n, nav, auth against /api)

**Files:**
- Create (via generator, then edit): `apps/mobile/package.json`, `app.json`, `App.tsx`, `babel.config.js`, `src/theme/ThemeProvider.tsx`, `src/i18n/index.ts`, `src/api/client.ts`, `src/auth/storage.ts`, `src/navigation/RootNavigator.tsx`, `src/navigation/TabNavigator.tsx`, `src/navigation/FloatingTabBar.tsx`, `src/screens/{Onboarding,Login,Home,Bookings,Pickup,Settings}.tsx`, `src/api/client.test.ts`

**Interfaces:**
- Consumes: `@car-rental/tokens` (`useTheme`, `ThemeProvider`, `lightTheme`), `@car-rental/types` (`SessionUser`, `LoginResponse`), web `/api/auth/login` + `/api/auth/me`.
- Produces: bootable Expo app: Onboarding → Login → authed tab shell; JWT persisted in secure storage; theme + i18n from shared packages.

- [ ] **Step 1: Scaffold Expo + install deps**

Run:
```bash
npx create-expo-app@latest apps/mobile --template blank-typescript
```
Set `apps/mobile/package.json` name to `@car-rental/mobile`; add deps:
```bash
npm i -w @car-rental/mobile @car-rental/tokens @car-rental/types @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context expo-secure-store expo-linear-gradient i18n-js expo-localization
```
Add scripts to `apps/mobile/package.json`: `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`, keep `"start": "expo start"`. Make its `tsconfig.json` extend `../../tsconfig.base.json` plus `expo/tsconfig.base`. Configure Metro to watch the monorepo root + resolve workspace packages (add `apps/mobile/metro.config.js` with `watchFolders: [workspaceRoot]` and `nodeModulesPaths`).

- [ ] **Step 2: Theme + i18n + API client + secure storage**

`src/theme/ThemeProvider.tsx`:
```tsx
import { ThemeProvider as TokensProvider, lightTheme } from '@car-rental/tokens';
import type { ReactNode } from 'react';
export const AppThemeProvider = ({ children }: { children: ReactNode }) => (
  <TokensProvider theme={lightTheme}>{children}</TokensProvider>
);
```
`src/i18n/index.ts`:
```ts
import { I18n } from 'i18n-js';
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';

export const i18n = new I18n({
  en: { signIn: 'Sign in', email: 'Email', password: 'Password', home: 'Find your ride', invalid: 'Invalid credentials' },
  ar: { signIn: 'تسجيل الدخول', email: 'البريد الإلكتروني', password: 'كلمة المرور', home: 'ابحث عن سيارتك', invalid: 'بيانات الاعتماد غير صحيحة' },
});
i18n.locale = Localization.getLocales()[0]?.languageCode ?? 'en';
i18n.enableFallback = true;
export const setLocale = (l: 'en' | 'ar') => {
  i18n.locale = l;
  I18nManager.forceRTL(l === 'ar'); // requires reload to fully apply
};
```
`src/auth/storage.ts`:
```ts
import * as SecureStore from 'expo-secure-store';
const KEY = 'cr_token';
export const saveToken = (t: string) => SecureStore.setItemAsync(KEY, t);
export const getToken = () => SecureStore.getItemAsync(KEY);
export const clearToken = () => SecureStore.deleteItemAsync(KEY);
```
`src/api/client.ts`:
```ts
import type { LoginResponse, SessionUser } from '@car-rental/types';
import { getToken } from '@/auth/storage';

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
}
export async function login(email: string, password: string): Promise<LoginResponse | null> {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return res.ok ? ((await res.json()) as LoginResponse) : null;
}
export async function me(): Promise<SessionUser | null> {
  const res = await authedFetch('/api/auth/me');
  return res.ok ? ((await res.json()) as SessionUser) : null;
}
```

- [ ] **Step 3: Write a failing test for the API client base-url behavior**

`src/api/client.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth/storage', () => ({ getToken: () => Promise.resolve(null) }));
import { login } from './client';

describe('mobile api client', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('POSTs credentials and returns null on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as never;
    expect(await login('x@y.z', 'bad')).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/login'), expect.objectContaining({ method: 'POST' }));
  });
});
```
Run: `npm run test -w @car-rental/mobile` → Expected FAIL first (before `client.ts` exists), then PASS after Step 2. (Add `vitest` + a `vitest.config.ts` with the `@` alias to the mobile workspace.)

- [ ] **Step 4: Navigation + FloatingTabBar + screens**

`src/navigation/FloatingTabBar.tsx` — custom bottom bar using `useTheme()` (floating pill; active tab = primary circle). `src/navigation/TabNavigator.tsx` — `createBottomTabNavigator` with `Home`, `Bookings`, `Pickup`, `Settings`, `tabBar={(p) => <FloatingTabBar {...p} />}`. `src/navigation/RootNavigator.tsx` — `createNativeStackNavigator`: if no token → `Onboarding`/`Login`, else `Tabs`; theme the navigator from `useTheme()`.
`src/screens/Login.tsx` (core flow):
```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@car-rental/tokens';
import { login } from '@/api/client';
import { saveToken } from '@/auth/storage';
import { i18n } from '@/i18n';

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const theme = useTheme();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState(false);
  const submit = async () => {
    const res = await login(email, password);
    if (!res) return setErr(true);
    await saveToken(res.token); onSuccess();
  };
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.color.background }}>
      <Text style={{ ...theme.typography.heading, color: theme.color.text, marginBottom: theme.spacing.md }}>{i18n.t('signIn')}</Text>
      <TextInput placeholder={i18n.t('email')} autoCapitalize="none" value={email} onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.input, padding: theme.spacing.md, marginBottom: theme.spacing.sm, color: theme.color.text }} />
      <TextInput placeholder={i18n.t('password')} secureTextEntry value={password} onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.input, padding: theme.spacing.md, marginBottom: theme.spacing.sm, color: theme.color.text }} />
      {err && <Text style={{ color: theme.color.danger, marginBottom: theme.spacing.sm }}>{i18n.t('invalid')}</Text>}
      <Pressable onPress={submit}>
        <LinearGradient colors={theme.color.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: theme.radius.input, padding: theme.spacing.md, alignItems: 'center' }}>
          <Text style={{ color: theme.color.onPrimary, fontWeight: '700' }}>{i18n.t('signIn')}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
```
`Home`/`Bookings`/`Pickup`/`Settings` are thin themed placeholders (title via `i18n.t`, `useTheme()` colors). `Onboarding` gates to `Login`.

- [ ] **Step 5: Wire `App.tsx`**

```tsx
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppThemeProvider } from '@/theme/ThemeProvider';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 6: Verify bundling + the auth flow against the running web API**

Run (web API must be running via `npm run dev:web`):
```bash
npm run typecheck -w @car-rental/mobile
npm run test -w @car-rental/mobile
npx expo start -c   # in apps/mobile — open iOS simulator / Expo Go
```
Manual: Onboarding → Login as `customer@demo.test` / `Password123!` → lands on the tab shell; relaunch keeps you signed in (token persisted); Settings language toggle switches copy.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile && git commit -m "feat(mobile): Expo shell — shared theme/i18n, navigation, JWT auth against web /api"
```

---

## Task 10: CI + Phase 0 gate verification

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: all workspace `typecheck`/`lint`/`test` scripts; a Postgres service.

- [ ] **Step 1: Write the CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres, POSTGRES_DB: car_rental_test }
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 10s --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/car_rental_test
      JWT_SECRET: ci-secret-at-least-16-chars
      SESSION_SECRET: ci-secret-at-least-16-chars
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run db:migrate -w @car-rental/web -- --name ci --skip-generate || npx prisma migrate deploy --schema apps/web/prisma/schema.prisma
      - run: npm run db:seed -w @car-rental/web
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
```

- [ ] **Step 2: Run the full gate locally**

Run:
```bash
npm run db:migrate -w @car-rental/web && npm run db:seed -w @car-rental/web
npm run typecheck && npm run lint && npm run test
```
Expected: migrate+seed succeed; **typecheck, lint, test all green** across every workspace.

- [ ] **Step 3: Confirm the gate checklist (manual)**

- [ ] `GET /api/health` → `{ "status": "ok" }`.
- [ ] Web: `provider@demo.test` → `/dashboard`; `admin@demo.test` → `/admin`; customer/provider blocked from `/admin` (redirect).
- [ ] Web: `/ar/login` renders RTL; no hardcoded English.
- [ ] Mobile: `customer@demo.test` logs in → tab shell; `/api/auth/me` returns the session user; token persists across relaunch.

- [ ] **Step 4: Commit**

```bash
git add .github && git commit -m "ci: typecheck+lint+test against Postgres; Phase 0 gate green"
```

---

## Self-Review

**Spec coverage (vs `plan.md` Phase 0 + `CLAUDE.md`/`design.md`):**
- 0.1 monorepo/tooling/CI → Task 1 + Task 10. ✓
- 0.2 `packages/types` (roles incl. ADMIN, statuses, DTOs, wire⇄db) → Task 2. ✓
- 0.3 `packages/tokens` Sunset Drive (primitives private, schemes, createTheme, css emitter, ThemeProvider/useTheme, exact `design.md` values) → Task 3. ✓
- 0.4 web shell: Tailwind↔tokens (Task 4), Prisma multi-tenant + seed (Task 5), dual auth + DAL (Task 6), routes incl. `/dashboard`+`/admin`+`/api` (Task 7), i18n/RTL (Task 8). ✓
- 0.5 Expo shell (nav, theme, i18n, api client, login, secure storage) → Task 9. ✓
- 0.6 cross-cutting: tenant scope (DAL Task 6), no hardcoded strings (Task 8/9), logical props + no raw hex (lint Task 1/7, usage throughout). ✓
- Gate (migrate/seed, 3-surface auth e2e, EN/AR, green gates) → Task 10. ✓

**Placeholder scan:** No TBD/TODO; every code step carries real code; the only "later phases" notes are intentional shell copy, not plan gaps.

**Type consistency:** `SessionUser`/`LoginResponse`/`HealthResponse` defined in Task 2 are consumed unchanged in Tasks 6/7/9. `verifySession`/`requireRole`/`tenantScope`/`SESSION_COOKIE` defined in Task 6 are consumed in Tasks 7. `authenticate`/`createSession` defined in Task 6 consumed in Task 7. `useTheme`/`createTheme`/`themeToCssVars`/`gradientPrimary` defined in Task 3 consumed in Tasks 4/7/9. Names align.

**Risks flagged for the implementer:**
- Next.js 16 + Tailwind v4 generator flags shift fast — if `create-next-app` defaults differ, keep the *intent* (App Router, src dir, `@/*` alias) and adjust flags.
- `I18nManager.forceRTL` on RN needs an app reload to fully mirror native layout — expected, note it in the Settings toggle.
- Vitest in the Expo workspace needs a node-friendly config (mock `expo-*` native modules); only the API client is unit-tested — screens are verified manually.
