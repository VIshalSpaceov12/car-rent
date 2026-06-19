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
