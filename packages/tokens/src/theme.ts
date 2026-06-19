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

const t = (fontSize: number, fontWeight: number, lineHeight: number, family: string = fontFamily.body, letterSpacing?: number): TextStyle =>
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
