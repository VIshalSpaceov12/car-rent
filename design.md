# Car Rental Platform — Design System (`design.md`)

Single source of truth for the **centralized** tokens (color, spacing, type, radius, elevation, z-index, motion) across **web (Next.js/Tailwind)** + **mobile (Expo RN)**. Tokens live in `@car-rental/tokens`. Components never inline a hex/px/font/duration — semantics only (lint-enforced). See `CLAUDE.md › Design system / Next.js conventions`.

**Brand:** **"Sunset Drive"** — warm, energetic, travel-forward. Coral-amber primary with a deep-navy ink, warm-cream canvas, and a teal accent. Friendly, rounded, confident. **Light is the default scheme**, with a dark sibling (same warm brand on deep navy-black). `defaultTheme` = **light**.

## Token structure

Layered so a reskin never disturbs layout, and a new brand/scheme is one file:

```
primitives.ts     PRIVATE raw ramps — palette{orange,teal,navy,slate,green,gold,red},
                  alpha, space[], radii, fontSize, fontFamily. Never exported.
themes/light.ts   ColorScheme (brand default)
themes/dark.ts    ColorScheme (sibling — same brand, navy-black surfaces)
theme.ts          Theme · ColorScheme · TextStyle · ElevationStyle types;
                  STATIC tokens (spacing/radius/typography/elevation/zIndex/motion);
                  createTheme(scheme, brandOverrides?) · lightTheme · darkTheme · defaultTheme=light
css.ts            generates CSS custom properties (:root + [data-theme=dark]) for the web/Tailwind
index.ts          public surface (primitives stay private)
```

Private primitives → semantic `ColorScheme` per scheme → `Theme` assembled with shared static tokens. A missing role is a **compile error**, not a runtime blank. Names are semantic (`primary`, `surfaceAlt`), never literal (`orange500`).

**Cross-platform application:**
- **Web:** `css.ts` emits CSS variables (`--color-primary`, …) onto `:root` / `[data-theme="dark"]`; Tailwind theme maps utilities to those vars. JSX references **CSS variables only — never raw hex** (lint-enforced), and uses **logical** Tailwind props (`ms-/me-/ps-/pe-`).
- **Mobile:** apps consume the JS `Theme` via `ThemeProvider` + `useTheme()`; RN styles use logical props (`marginStart`, `paddingEnd`) and `I18nManager` for RTL.

## Color — themeable (the only themeable layer)

**Light scheme (brand default):**

| Role | Hex | Use |
|------|-----|-----|
| `primary` | `#F97316` | CTAs, active tab, FAB, accents |
| `primaryDark` | `#EA580C` | pressed / gradient end |
| `onPrimary` | `#FFFFFF` | text/icon on primary |
| `accent` | `#0EA5A4` | secondary actions, links, info, `vehicle-prepared`/`returned` chips |
| `accentDark` | `#0D9488` | pressed accent |
| `background` | `#FFF8F3` | app canvas (warm cream) |
| `surface` | `#FFFFFF` | cards |
| `surfaceAlt` | `#FCEFE6` | tiles, inputs, icon circles |
| `text` | `#0B1F3A` | headings, prices (deep navy ink) |
| `textMuted` | `#5B6B82` | subtitles |
| `textSubtle` | `#94A3B8` | meta / disabled |
| `border` | `#EADFD4` | hairlines, tile edges (warm) |
| `success` | `#16A34A` | confirmed, paid, completed, OTP success |
| `warning` | `#F59E0B` | warnings |
| `rating` | `#FACC15` | gold rating stars |
| `danger` | `#EF4444` | errors, rejected/cancelled |
| `info` | `#0EA5A4` | informational (= accent) |
| `overlay` | `rgba(11,31,58,0.55)` | photo scrims, modal backdrops |
| `gradientPrimary` | `['#F97316', '#EA580C']` | hero CTA / FAB fill (darkens so white text stays legible) |
| `glow` | `rgba(249,115,22,0.35)` | accent glow / focus halo |

**Dark sibling:** `background #0B1220` · `surface #131C2E` · `surfaceAlt #1B2540` · `text #F8FAFC` · `textMuted #94A3B8` · `textSubtle #64748B` · `border #283349` · `overlay rgba(0,0,0,0.60)`. Brand (`primary`/`primaryDark`/`accent`/gradient) + status hues are **identical across schemes** — only neutrals flip, so light/dark is just another color set.

**Contrast:** white-on-`primary` (`#F97316`) is only ≈ **2.8:1** — it **fails** AA. So filled CTAs use the **gradient ending at `primaryDark` (`#EA580C`)**, where white ≈ **3.5:1** (passes AA for large/bold text + UI components). Rules: white text on brand only at `title`+ weight on the gradient fill; for small text or solid `primary` chips, use **navy ink (`text`)** (`#0B1F3A` on `#F97316` ≈ 5.9:1). Status **text** uses `success`/`danger` only — never `warning`/`rating` (gold fails as text; reserve for stars/badges).

**White-label:** `createTheme(scheme, brandOverrides?)` merges a provider's `primary`/`primaryDark`(/`accent`) over a scheme; when the override omits `gradientPrimary`/`glow`, they're **derived** (`gradientPrimary = [primary, darken(primary)]`, `glow = primary @ 0.35`) so any provider gets a coherent gradient + glow for free. Sunset Drive default keeps its hand-picked coral→amber gradient.

### Booking-status → token mapping
`reserved` → `textSubtle`/neutral · `confirmed` → `success` · `vehicle-prepared` → `accent` · `picked-up` → `primary` · `returned` → `accent` · `completed` → `success` · `rejected`/`cancelled` → `danger`. Chips are tinted (`color @ ~12% bg` + solid text/dot).

## Spacing · Type · Radius · Elevation · Z-index (static, semantic)

Access as `theme.spacing.*` / `theme.typography.*` / `theme.radius.*` — never raw numbers. Font sizes live **inside** type roles. RTL: logical props only.

| Spacing | px | | Type role | size/wt/lh | | Radius | px |
|---|---|---|---|---|---|---|---|
| `none` | 0 | | `display` | 40/800/46 (ls −0.5) | | `sm` | 10 |
| `xs` | 4 | | `heading` | 28/700/34 | | `md` | 14 |
| `sm` | 8 | | `title` | 20/600/26 | | `lg` | 18 |
| `md` | 16 | | `subtitle` | 15/500/20 | | `card` | 18 |
| `lg` | 24 | | `body` | 16/400/24 | | `input` | 12 |
| `xl` | 32 | | `caption` | 13/400/18 | | `pill` | 999 |
| `xxl` | 48 | | `label` | 13/600/16 | | | |

**Type family (themeable):** `Plus Jakarta Sans` for `display`/`heading`/`title`; `Inter` for body/UI. Fallback `System`. Web loads via `next/font`; mobile via `expo-font`.

**Elevation** (`none/sm/md/lg`) — framework-agnostic `{shadowColor, shadowOpacity, shadowRadius, shadowOffset, elevation}`; RN consumes directly, web maps to `box-shadow`. A dedicated **`glow`** elevation (brand-tinted) is used on primary CTAs/FAB. **Z-index:** `base 0 · card 1 · header 10 · overlay 100 · modal 1000 · toast 2000`.

**Size** (`theme.size`, static) — `icon{xs14·sm16·md18·lg20·xl22·xxl24·hero32}` · `control{sm40·md52·lg60}` (circular buttons/FABs) · `touchTarget 44`. One-off layout dimensions stay as named consts in the component, not tokens.

**Enforcement:** primitives private; every scheme satisfies `ColorScheme`, every theme `Theme` (missing role = compile error); tokens resolve at runtime via `ThemeProvider` (RN) / CSS vars (web); lint fails a raw `#fff`/`16` in JSX; web + mobile share role names.

## Component layers

primitives → composed → screens; each layer knows only the one below. Thin screens compose (data/nav/layout; logic in hooks); props-driven theming, variants over copy-paste, no literals. **One UI vocabulary across repos** — same names + prop contracts (`<Button variant="primary" size="md">`) despite platform-specific impl.

| Layer | Components |
|---|---|
| **Primitives** | `Button` (gradient fill + glow + press spring) · `TextField` · `Icon` · `CircleButton` · `Avatar` · `Toast` (in-house) · `Skeleton` (shimmer) · `StatusChip` (tinted + dot) · `UnlockButton` (OTP hero) |
| **Composed (mobile)** | `SearchPill` · `SectionHeader` · `CarHeroCard` · `CarListCard` · `RatingBadge` · `BookingSummary` · `CtaBar` · `FloatingTabBar` |
| **Composed (web)** | `Sidebar` (navy, gradient logo, nav, user chip) · `StatCard` (count-up + trend) · `DataTable` (`AnimatedRow`) · `TitleRow` · `FilterBar` |
| **Screens (mobile)** | `Onboarding` · `Browse` · `Details` · `Booking` · `Pickup` (OTP) · `Bookings` |
| **Screens (web)** | `/dashboard` (provider) · `/admin` (platform) shells, each with overview + entity pages |

## Motion & animation

**Runtime:** mobile → `react-native-reanimated` (+ `react-native-gesture-handler`, `expo-linear-gradient`); web → `framer-motion`. **Toast is in-house.** Motion tokens centralized (no magic numbers) and **static**.

**Motion tokens** (`Theme.motion`): `duration.fast` 120 · `base` 200 · `slow` 320 · `hero` 480 ms; `easing.standard` `[0.2,0,0,1]` / `enter` `[0,0,0,1]` / `exit` `[0.4,0,1,1]` / `spring` `[0.34,1.56,0.64,1]`; `spring.press` `{ damping 18, stiffness 240, mass 0.8 }`.

| Moment | Animation |
|--------|-----------|
| Screen transitions | platform push; slide-up modal for booking/checkout |
| Button / CarCard press | scale 0.97 + lift, `spring.press` |
| List/detail load | skeleton shimmer (no spinner) → cross-fade |
| Booking status change | status-chip color+label cross-fade on realtime event |
| Toast | in-house: slide-down, auto-dismiss, swipe to clear (OTP/payment/error feedback) |
| OTP unlock (hero) | lock→unlock morph (`duration.hero`) + success toast |

**RTL:** slide directions flip in AR. **Reduce-motion:** fall back to cross-fade/instant.

## Status

Design language **locked** ("Sunset Drive", light default + dark sibling) via the brainstorming visual companion. Token implementation in `@car-rental/tokens` lands in **Phase 0** (see `plan.md`).
