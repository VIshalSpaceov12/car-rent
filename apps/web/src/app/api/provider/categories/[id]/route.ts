import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { categoryCreateSchema } from '@car-rental/types';
import { categoryToDTO } from '@/server/mappers';

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

  const body = await req.json().catch(() => null);
  const parsed = categoryCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  // Atomic tenant-scoped update — cross-tenant writes return count=0
  const result = await prisma.vehicleCategory.updateMany({
    where: { id, ...tenantScope(user) },
    data: parsed.data,
  });
  if (result.count === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const category = await prisma.vehicleCategory.findFirst({ where: { id } });
  if (!category) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json(categoryToDTO(category));
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

  // Atomic tenant-scoped delete — cross-tenant deletes return count=0
  const result = await prisma.vehicleCategory.deleteMany({ where: { id, ...tenantScope(user) } });
  if (result.count === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
