// Server-safe exports: no React context, no client-only APIs
export type { ColorScheme, Theme } from './theme';
export { createTheme, lightTheme, darkTheme, defaultTheme } from './theme';
export { themeToCssVars, cssVarBlock } from './css';
