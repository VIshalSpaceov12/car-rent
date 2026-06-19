import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { branchCreateSchema } from '@car-rental/types';
import { branchToDTO } from '@/server/mappers';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });

  const body = await req.json().catch(() => null);
  const parsed = branchCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  // Atomic tenant-scoped update — cross-tenant writes return count=0
  const result = await prisma.branch.updateMany({
    where: { id, ...tenantScope(user) },
    data: parsed.data,
  });
  if (result.count === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const branch = await prisma.branch.findFirst({ where: { id } });
  if (!branch) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json(branchToDTO(branch));
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });

  // Atomic tenant-scoped delete — cross-tenant deletes return count=0
  const result = await prisma.branch.deleteMany({ where: { id, ...tenantScope(user) } });
  if (result.count === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
