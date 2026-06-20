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
  const now = new Date();
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    bookings,
    payments,
    totalVehicles,
    activeBookings,
  ] = await Promise.all([
    prisma.booking.findMany({ where: scope, select: { id: true } }),
    prisma.payment.findMany({
      where: { ...scope, status: 'PAID' },
      select: { amount: true, createdAt: true },
    }),
    prisma.vehicle.count({ where: scope }),
    prisma.booking.count({
      where: { ...scope, status: { in: ['CONFIRMED', 'VEHICLE_PREPARED', 'PICKED_UP'] } },
    }),
  ]);

  const revenueTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const revenueMTD = payments
    .filter((p) => p.createdAt >= mtdStart)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const fleetUtilizationPct = totalVehicles > 0
    ? Math.round((activeBookings / totalVehicles) * 100)
    : 0;

  // Popular vehicles: count completed/active bookings per vehicle
  const vehicleBookingCounts = await prisma.booking.groupBy({
    by: ['vehicleId'],
    where: { ...scope, status: { in: ['COMPLETED', 'PICKED_UP', 'CONFIRMED'] } },
    _count: { vehicleId: true },
    orderBy: { _count: { vehicleId: 'desc' } },
    take: 5,
  });

  const popularVehicleIds = vehicleBookingCounts.map((v) => v.vehicleId);
  const popularVehicles = await prisma.vehicle.findMany({
    where: { id: { in: popularVehicleIds } },
    select: { id: true, name: true, make: true, model: true },
  });

  const popularVehiclesWithCount = vehicleBookingCounts.map((vc) => {
    const v = popularVehicles.find((pv) => pv.id === vc.vehicleId);
    return {
      vehicleId: vc.vehicleId,
      name: v?.name ?? 'Unknown',
      make: v?.make ?? null,
      model: v?.model ?? null,
      bookingCount: vc._count.vehicleId,
    };
  });

  return NextResponse.json({
    revenueTotal: Math.round(revenueTotal * 100) / 100,
    revenueMTD: Math.round(revenueMTD * 100) / 100,
    bookingsCount: bookings.length,
    activeRentals: activeBookings,
    fleetUtilizationPct,
    popularVehicles: popularVehiclesWithCount,
  });
}
