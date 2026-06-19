import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole } from '@/server/auth/dal';
import { hashPassword } from '@/server/auth/password';
import { z } from 'zod';

const staffCreateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // Only providers (not staff) can manage staff
  try { requireRole(user, 'provider', 'admin'); } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const staff = await prisma.user.findMany({
    where: { role: 'STAFF', providerId: user.providerId! },
    select: {
      id: true, name: true, email: true, role: true,
      providerId: true, createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(staff.map((s) => ({
    id: s.id, name: s.name, email: s.email,
    role: s.role.toLowerCase(),
    providerId: s.providerId,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  })));
}

export async function POST(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // Only the provider role (not staff) can create staff
  try { requireRole(user, 'provider', 'admin'); } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const parsed = staffCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  // ALWAYS force role=STAFF and providerId from session — never trust client
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 });
  }

  const staffUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'STAFF', // Hard-coded — never from client body
      providerId: user.providerId!, // Always from session
      locale: 'EN',
    },
    select: {
      id: true, name: true, email: true, role: true,
      providerId: true, createdAt: true, updatedAt: true,
    },
  });

  return NextResponse.json({
    id: staffUser.id,
    name: staffUser.name,
    email: staffUser.email,
    role: staffUser.role.toLowerCase(),
    providerId: staffUser.providerId,
    createdAt: staffUser.createdAt.toISOString(),
    updatedAt: staffUser.updatedAt.toISOString(),
  }, { status: 201 });
}
