import { createElement, type ReactNode } from 'react';
import { ThemeContext } from './useTheme';
import { defaultTheme, type Theme } from './theme';

export function ThemeProvider({ theme = defaultTheme, children }: { theme?: Theme; children: ReactNode }) {
  return createElement(ThemeContext.Provider, { value: theme }, children);
}
