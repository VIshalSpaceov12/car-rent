import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/server/auth/dal';

const PROTECTED = ['/dashboard', '/admin'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/')) && !req.cookies.get(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
