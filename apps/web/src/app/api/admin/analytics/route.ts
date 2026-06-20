import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole } from '@/server/auth/dal';

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Admin is cross-tenant — no scope filter on any query

  const [
    providersTotal,
    providersActive,
    bookingsTotal,
    activeRentals,
    paidPayments,
    topProviderData,
  ] = await Promise.all([
    prisma.provider.count(),
    prisma.provider.count({ where: { status: 'active' } }),
    prisma.booking.count(),
    prisma.booking.count({
      where: { status: { in: ['CONFIRMED', 'VEHICLE_PREPARED', 'PICKED_UP'] } },
    }),
    prisma.payment.findMany({
      where: { status: 'PAID' },
      select: { amount: true, providerId: true },
    }),
    prisma.provider.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        _count: { select: { bookings: true } },
      },
    }),
  ]);

  const revenueTotal =
    Math.round(paidPayments.reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;

  // Revenue per provider
  const revenueByProvider: Record<string, number> = {};
  for (const p of paidPayments) {
    revenueByProvider[p.providerId] = (revenueByProvider[p.providerId] ?? 0) + Number(p.amount);
  }

  const topProviders = topProviderData
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      bookingsCount: p._count.bookings,
      revenue: Math.round((revenueByProvider[p.id] ?? 0) * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return NextResponse.json({
    providersTotal,
    providersActive,
    bookingsTotal,
    revenueTotal,
    activeRentals,
    topProviders,
  });
}
