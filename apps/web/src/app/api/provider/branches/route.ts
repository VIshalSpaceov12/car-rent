import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { branchCreateSchema } from '@car-rental/types';
import { branchToDTO } from '@/server/mappers';

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const branches = await prisma.branch.findMany({
    where: tenantScope(user),
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(branches.map(branchToDTO));
}

export async function POST(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const resolvedProviderId = user.providerId;
  if (!resolvedProviderId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const parsed = branchCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const branch = await prisma.branch.create({
    data: { ...parsed.data, providerId: resolvedProviderId },
  });

  return NextResponse.json(branchToDTO(branch), { status: 201 });
}
