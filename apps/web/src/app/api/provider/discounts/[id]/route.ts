import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole } from '@/server/auth/dal';
import { discountCreateSchema, discountKindFromDb, type DiscountCodeDTO } from '@car-rental/types';

function toDTO(d: {
  id: string; providerId: string; code: string; kind: string; value: { toString(): string } | number;
  active: boolean; expiresAt: Date | null; createdAt: Date;
}): DiscountCodeDTO {
  const dto: DiscountCodeDTO = {
    id: d.id, providerId: d.providerId, code: d.code,
    kind: discountKindFromDb(d.kind),
    value: Number(d.value),
    active: d.active,
    createdAt: d.createdAt.toISOString(),
  };
  if (d.expiresAt) dto.expiresAt = d.expiresAt.toISOString();
  return dto;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try { requireRole(user, 'provider', 'staff', 'admin'); } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const { id } = await params;
  const existing = await prisma.discountCode.findFirst({ where: { id, providerId: user.providerId! } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = discountCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const { kind, expiresAt, ...rest } = parsed.data;
  const updated = await prisma.discountCode.update({
    where: { id },
    data: {
      ...rest,
      ...(kind ? { kind: kind.toUpperCase() as 'PERCENT' | 'FIXED' } : {}),
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
    },
  });

  return NextResponse.json(toDTO(updated));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try { requireRole(user, 'provider', 'staff', 'admin'); } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const { id } = await params;
  const existing = await prisma.discountCode.findFirst({ where: { id, providerId: user.providerId! } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.discountCode.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
