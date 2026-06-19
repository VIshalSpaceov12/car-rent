'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticate, createSession } from '@/server/modules/auth/auth.service';
import { SESSION_COOKIE } from '@/server/auth/dal';
import { isValidLocale, defaultLocale } from '@/i18n/request';

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const rawLocale = String(formData.get('locale') ?? '');
  const locale = isValidLocale(rawLocale) ? rawLocale : defaultLocale;

  const result = await authenticate(email, password);
  if (!result) return { error: 'invalid_credentials' };

  const session = await createSession(result.user.id);
  (await cookies()).set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: session.expiresAt,
    path: '/',
  });
  redirect(result.user.role === 'admin' ? `/${locale}/admin` : `/${locale}/dashboard`);
}
