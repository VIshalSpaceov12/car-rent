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
