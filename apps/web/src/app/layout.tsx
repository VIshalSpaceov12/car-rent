import type { ReactNode } from 'react';

// Root layout: pass-through. The [locale]/layout.tsx renders <html>/<body>
// with dir, lang, data-theme, CSS vars, and NextIntlClientProvider.
export default function RootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
