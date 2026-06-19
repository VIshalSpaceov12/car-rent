import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginRequestSchema } from '@car-rental/types';
import { authenticate, createSession } from '@/server/modules/auth/auth.service';
import { SESSION_COOKIE } from '@/server/auth/dal';

export async function POST(req: Request) {
  const parsed = loginRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  // web also gets an httpOnly cookie session; mobile uses the returned token
  const session = await createSession(result.user.id);
  (await cookies()).set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: session.expiresAt,
    path: '/',
  });
  return NextResponse.json(result);
}
