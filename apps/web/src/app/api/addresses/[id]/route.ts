import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import { addressCreateSchema, type AddressDTO } from '@car-rental/types';

function toDTO(a: {
  id: string; userId: string; label: string; line1: string;
  city: string; country: string; isDefault: boolean; createdAt: Date;
}): AddressDTO {
  return {
    id: a.id, userId: a.userId, label: a.label, line1: a.line1,
    city: a.city, country: a.country, isDefault: a.isDefault,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'customer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = addressCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }
    return tx.address.update({ where: { id }, data: parsed.data });
  });

  return NextResponse.json(toDTO(updated));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'customer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await prisma.address.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
