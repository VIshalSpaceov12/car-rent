import bcrypt from 'bcrypt';
import { prisma } from '@/server/db';
import { roleFromDb, type LoginResponse, type SessionUser, type Locale, type UserRole } from '@car-rental/types';
import { verifyPassword } from '@/server/auth/password';
import { signJwt } from '@/server/auth/jwt';

const DUMMY_HASH = bcrypt.hashSync('dummy-timing-equalizer', 10);

const toSessionUser = (u: { id: string; email: string; name: string; role: string; providerId: string | null; locale: string }): SessionUser => ({
  id: u.id, email: u.email, name: u.name,
  role: roleFromDb(u.role) as UserRole, providerId: u.providerId, locale: u.locale.toLowerCase() as Locale,
});

export async function authenticate(email: string, password: string): Promise<LoginResponse | null> {
  const u = await prisma.user.findUnique({ where: { email } });
  const hashToCheck = u?.passwordHash ?? DUMMY_HASH;
  const valid = await verifyPassword(password, hashToCheck);
  if (!u || !valid) return null;
  return { token: signJwt(u.id), user: toSessionUser(u) };
}

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const s = await prisma.session.create({ data: { userId, expiresAt } });
  return { id: s.id, expiresAt };
}
