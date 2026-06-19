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

  const existing = await prisma.branch.findFirst({
    where: { id, ...tenantScope(user) },
  });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = branchCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const branch = await prisma.branch.update({
    where: { id },
    data: parsed.data,
  });

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

  const existing = await prisma.branch.findFirst({
    where: { id, ...tenantScope(user) },
  });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.branch.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
