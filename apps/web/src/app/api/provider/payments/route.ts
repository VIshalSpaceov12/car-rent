import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { paymentToDTO } from '@/server/mappers';

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

  const scope = tenantScope(user);

  const payments = await prisma.payment.findMany({
    where: scope,
    orderBy: { createdAt: 'desc' },
    include: {
      booking: {
        select: {
          id: true,
          currency: true,
          totalAmount: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  return NextResponse.json(payments.map(paymentToDTO));
}
