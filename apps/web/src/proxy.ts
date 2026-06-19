/**
 * Auth-guard proxy (Next 16 middleware file).
 *
 * Locale strategy: Approach B — no next-intl middleware.
 * Routes live under /[locale]/... and next-intl reads the segment via
 * getRequestConfig({ requestLocale }). This proxy only handles auth.
 *
 * Protected paths: /[locale]/dashboard and /[locale]/admin.
 * Unauthenticated users are redirected to /[locale]/login.
 *
 * API routes (/api/*) are excluded via the matcher config below.
 */
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/server/auth/dal';

const LOCALES = ['en', 'ar'];
const DEFAULT_LOCALE = 'en';

// Matches /[locale]/dashboard or /[locale]/admin (with optional trailing path)
function isProtected(pathname: string): boolean {
  return LOCALES.some(
    (locale) =>
      pathname === `/${locale}/dashboard` ||
      pathname.startsWith(`/${locale}/dashboard/`) ||
      pathname === `/${locale}/admin` ||
      pathname.startsWith(`/${locale}/admin/`),
  );
}

// Extract locale prefix from pathname, or fall back to default
function localeFrom(pathname: string): string {
  const seg = pathname.split('/')[1] ?? '';
  return LOCALES.includes(seg) ? seg : DEFAULT_LOCALE;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isProtected(pathname) && !req.cookies.get(SESSION_COOKIE)) {
    const locale = localeFrom(pathname);
    return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
