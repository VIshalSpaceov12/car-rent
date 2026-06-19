import type { ReactNode } from 'react';
import { rootThemeCss } from '@/lib/theme-style';
import './globals.css';

export const metadata = { title: 'Car Rental', description: 'White-label car rental' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head><style dangerouslySetInnerHTML={{ __html: rootThemeCss }} /></head>
      <body>{children}</body>
    </html>
  );
}
