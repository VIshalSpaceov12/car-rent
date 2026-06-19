import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try { requireRole(user, 'provider', 'staff', 'admin'); } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const scope = tenantScope(user);

  // Distinct customers who booked this tenant, with booking counts
  const bookingAgg = await prisma.booking.groupBy({
    by: ['customerId'],
    where: scope,
    _count: { customerId: true },
  });

  const customerIds = bookingAgg.map((b) => b.customerId);
  const customers = await prisma.user.findMany({
    where: { id: { in: customerIds }, role: 'CUSTOMER' },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const countMap = new Map(bookingAgg.map((b) => [b.customerId, b._count.customerId]));

  return NextResponse.json(
    customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      createdAt: c.createdAt.toISOString(),
      bookingCount: countMap.get(c.id) ?? 0,
    }))
  );
}
