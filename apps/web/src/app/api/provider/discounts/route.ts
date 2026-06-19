import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
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

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try { requireRole(user, 'provider', 'staff', 'admin'); } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const discounts = await prisma.discountCode.findMany({
    where: tenantScope(user),
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(discounts.map(toDTO));
}

export async function POST(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try { requireRole(user, 'provider', 'staff', 'admin'); } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const parsed = discountCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const { code, kind, value, active, expiresAt } = parsed.data;
  const providerId = user.providerId!;

  const discount = await prisma.discountCode.create({
    data: {
      providerId,
      code,
      kind: kind.toUpperCase() as 'PERCENT' | 'FIXED',
      value,
      active: active ?? true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json(toDTO(discount), { status: 201 });
}
