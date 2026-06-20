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

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'customer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json(addresses.map(toDTO));
}

export async function POST(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'customer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = addressCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const { label, line1, city, country, isDefault } = parsed.data;

  const address = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }
    return tx.address.create({ data: { userId: user.id, label, line1, city, country, isDefault: isDefault ?? false } });
  });

  return NextResponse.json(toDTO(address), { status: 201 });
}
