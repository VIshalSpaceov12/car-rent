import 'server-only';
import { cookies, headers } from 'next/headers';
import { prisma } from '@/server/db';
import { roleFromDb, type SessionUser, type UserRole, type Locale } from '@car-rental/types';
import { verifyJwt } from './jwt';

const SESSION_COOKIE = 'cr_session';

export async function verifySession(): Promise<SessionUser | null> {
  // 1) bearer JWT (mobile)
  const auth = (await headers()).get('authorization');
  let userId: string | null = null;
  if (auth?.startsWith('Bearer ')) userId = verifyJwt(auth.slice(7))?.userId ?? null;
  // 2) cookie session id (web)
  if (!userId) {
    const sid = (await cookies()).get(SESSION_COOKIE)?.value;
    if (sid) {
      const session = await prisma.session.findUnique({ where: { id: sid } });
      if (session && session.expiresAt > new Date()) userId = session.userId;
    }
  }
  if (!userId) return null;
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return null;
  const role = roleFromDb(u.role) as UserRole;
  // Block suspended-tenant sessions for provider/staff; admin and customer are unaffected.
  if ((role === 'provider' || role === 'staff') && u.providerId) {
    const provider = await prisma.provider.findUnique({
      where: { id: u.providerId },
      select: { status: true },
    });
    if (provider?.status === 'suspended') return null;
  }
  return {
    id: u.id, email: u.email, name: u.name,
    role,
    providerId: u.providerId, locale: u.locale.toLowerCase() as Locale,
  };
}

export function requireRole(user: SessionUser, ...roles: UserRole[]): void {
  if (!roles.includes(user.role)) throw new Error('FORBIDDEN');
}

/** Returns the Prisma where-fragment that scopes a query to the caller's tenant. Admin = no scope. */
export function tenantScope(user: SessionUser): { providerId?: string } {
  if (user.role === 'admin') return {};
  return user.providerId ? { providerId: user.providerId } : {};
}

export { SESSION_COOKIE };
