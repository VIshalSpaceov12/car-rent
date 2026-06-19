import { ThemeProvider as TokensProvider, lightTheme } from '@car-rental/tokens';
import type { ReactNode } from 'react';

export const AppThemeProvider = ({ children }: { children: ReactNode }) => (
  <TokensProvider theme={lightTheme}>{children}</TokensProvider>
);
