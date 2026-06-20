import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { StatusChip } from '@/ui/StatusChip';

export default async function AdminAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  try {
    requireRole(user, 'admin');
  } catch {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations('admin.analytics');

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

  const maxRevenue = topProviders[0]?.revenue ?? 1;

  const cards = [
    { label: t('providersTotal'), value: providersTotal.toString() },
    { label: t('providersActive'), value: providersActive.toString() },
    { label: t('bookingsTotal'), value: bookingsTotal.toString() },
    {
      label: t('revenueTotal'),
      value: `$${revenueTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    { label: t('activeRentals'), value: activeRentals.toString() },
  ];

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-lg">{t('title')}</h1>

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

      <div className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md">
        <h2 className="text-base font-semibold text-cr-text mb-cr-md">{t('topProviders')}</h2>
        {topProviders.length === 0 ? (
          <p className="text-cr-text-muted text-sm">{t('topProviders')}</p>
        ) : (
          <div className="flex flex-col gap-cr-sm">
            {topProviders.map((p) => {
              const pct = maxRevenue > 0 ? Math.round((p.revenue / maxRevenue) * 100) : 0;
              return (
                <div key={p.id} className="flex items-center gap-cr-md">
                  <div className="shrink-0 flex items-center gap-cr-sm" style={{ minWidth: '12rem' }}>
                    <span className="text-sm text-cr-text font-medium">{p.name}</span>
                    <StatusChip
                      status={p.status}
                      label={p.status}
                    />
                  </div>
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
                    {p.bookingsCount} {t('bookings')} · $
                    {p.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
