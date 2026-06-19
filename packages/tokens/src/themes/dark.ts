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
