import { useState, useEffect, type ReactNode } from 'react';
import { ThemeProvider as TokensProvider, lightTheme, createTheme } from '@car-rental/tokens';
import type { Theme } from '@car-rental/tokens';
import { getBranding } from '@/api/client';

export const AppThemeProvider = ({ children }: { children: ReactNode }) => {
  // Start with the static lightTheme while branding loads — no flicker.
  const [theme, setTheme] = useState<Theme>(lightTheme);

  useEffect(() => {
    let cancelled = false;
    getBranding().then((brand) => {
      if (cancelled || !brand) return;
      const derived = createTheme('light', {
        primary: brand.primary,
        primaryDark: brand.primaryDark,
      });
      setTheme(derived);
    });
    return () => { cancelled = true; };
  }, []);

  return <TokensProvider theme={theme}>{children}</TokensProvider>;
};
