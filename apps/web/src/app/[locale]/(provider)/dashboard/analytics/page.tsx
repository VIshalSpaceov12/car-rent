import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    redirect(wrongRoleTarget(user.role, locale));
  }
  if (user.role !== 'admin' && !user.providerId) redirect(wrongRoleTarget(user.role, locale));

  const t = await getTranslations('analytics');

  const scope = tenantScope(user);
  const now = new Date();
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [payments, bookingsCount, totalVehicles, activeBookings, vehicleBookingCounts] =
    await Promise.all([
      prisma.payment.findMany({
        where: { ...scope, status: 'PAID' },
        select: { amount: true, createdAt: true },
      }),
      prisma.booking.count({ where: scope }),
      prisma.vehicle.count({ where: scope }),
      prisma.booking.count({
        where: {
          ...scope,
          status: { in: ['CONFIRMED', 'VEHICLE_PREPARED', 'PICKED_UP'] },
        },
      }),
      prisma.booking.groupBy({
        by: ['vehicleId'],
        where: { ...scope, status: { in: ['COMPLETED', 'PICKED_UP', 'CONFIRMED'] } },
        _count: { vehicleId: true },
        orderBy: { _count: { vehicleId: 'desc' } },
        take: 5,
      }),
    ]);

  const revenueTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const revenueMTD = payments
    .filter((p) => p.createdAt >= mtdStart)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const fleetUtilizationPct =
    totalVehicles > 0 ? Math.round((activeBookings / totalVehicles) * 100) : 0;

  const popularVehicleIds = vehicleBookingCounts.map((v) => v.vehicleId);
  const popularVehicles =
    popularVehicleIds.length > 0
      ? await prisma.vehicle.findMany({
          where: { id: { in: popularVehicleIds } },
          select: { id: true, name: true, make: true, model: true },
        })
      : [];

  const popularWithCount = vehicleBookingCounts.map((vc) => {
    const v = popularVehicles.find((pv) => pv.id === vc.vehicleId);
    return {
      vehicleId: vc.vehicleId,
      name: v?.name ?? 'Unknown',
      bookingCount: vc._count.vehicleId,
    };
  });

  const maxCount = popularWithCount[0]?.bookingCount ?? 1;

  const cards = [
    { label: t('revenueTotal'), value: `$${revenueTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: t('revenueMTD'), value: `$${revenueMTD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { label: t('bookingsCount'), value: bookingsCount.toString() },
    { label: t('activeRentals'), value: activeBookings.toString() },
    { label: t('fleetUtilization'), value: `${fleetUtilizationPct}%` },
  ];

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-lg">{t('title')}</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-cr-md mb-cr-lg sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md flex flex-col gap-cr-xs"
          >
            <span className="text-xs text-cr-text-muted font-medium uppercase tracking-wide">
              {card.label}
            </span>
            <span className="text-2xl font-bold text-cr-primary">{card.value}</span>
          </div>
        ))}
      </div>

      {/* Popular vehicles bar chart */}
      <div className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md">
        <h2 className="text-base font-semibold text-cr-text mb-cr-md">{t('popularVehicles')}</h2>
        {popularWithCount.length === 0 ? (
          <p className="text-cr-text-muted text-sm">{t('noPopularVehicles')}</p>
        ) : (
          <div className="flex flex-col gap-cr-sm">
            {popularWithCount.map((v) => {
              const pct = Math.round((v.bookingCount / maxCount) * 100);
              return (
                <div key={v.vehicleId} className="flex items-center gap-cr-md">
                  <span
                    className="text-sm text-cr-text font-medium shrink-0"
                    style={{ minWidth: '10rem' }}
                  >
                    {v.name}
                  </span>
                  <div className="flex-1 rounded-cr-pill overflow-hidden bg-cr-surface-alt h-4">
                    <div
                      className="h-full rounded-cr-pill"
                      style={{
                        width: `${pct}%`,
                        background: 'var(--color-primary)',
                        opacity: 0.8,
                        transition: 'width 0.4s',
                      }}
                    />
                  </div>
                  <span className="text-xs text-cr-text-muted shrink-0">
                    {v.bookingCount} {t('bookings')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
