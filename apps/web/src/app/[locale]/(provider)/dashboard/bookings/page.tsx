import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { bookingToDTO } from '@/server/mappers';
import { StatusChip } from '@/ui/StatusChip';
import { BOOKING_STATUSES, bookingStatusToDb, type BookingStatus } from '@car-rental/types';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

const BOOKING_INCLUDE = {
  vehicle: { select: { id: true, name: true } },
  customer: { select: { name: true } },
  pickupBranch: { select: { name: true } },
  dropoffBranch: { select: { name: true } },
} as const;

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status: statusFilter } = await searchParams;

  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    redirect(wrongRoleTarget(user.role, locale));
  }
  if (user.role !== 'admin' && !user.providerId) redirect(wrongRoleTarget(user.role, locale));

  // Validate status filter
  const validStatus =
    statusFilter && (BOOKING_STATUSES as readonly string[]).includes(statusFilter)
      ? (statusFilter as BookingStatus)
      : undefined;

  const where: Record<string, unknown> = { ...tenantScope(user) };
  if (validStatus) {
    where.status = bookingStatusToDb(validStatus);
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: BOOKING_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  // Attach customerName to each DTO
  const rows = bookings.map((b) => ({
    ...bookingToDTO(b),
    customerName: (b as typeof b & { customer: { name: string } }).customer.name,
  }));

  const t = await getTranslations('bookings');

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <div className="flex items-center justify-between mb-cr-lg gap-cr-md flex-wrap">
        <h1 className="text-2xl font-bold text-cr-text">{t('title')}</h1>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-cr-sm mb-cr-lg">
        <Link
          href={`/${locale}/dashboard/bookings`}
          className={`px-cr-sm py-cr-xs rounded-cr-pill text-sm font-medium border transition ${
            !validStatus
              ? 'border-cr-primary text-cr-primary bg-cr-surface-alt'
              : 'border-cr-border text-cr-text-muted bg-cr-surface hover:bg-cr-surface-alt'
          }`}
        >
          {t('filter.all')}
        </Link>
        {BOOKING_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/${locale}/dashboard/bookings?status=${s}`}
            className={`px-cr-sm py-cr-xs rounded-cr-pill text-sm font-medium border transition ${
              validStatus === s
                ? 'border-cr-primary text-cr-primary bg-cr-surface-alt'
                : 'border-cr-border text-cr-text-muted bg-cr-surface hover:bg-cr-surface-alt'
            }`}
          >
            {t(`status.${s}`)}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-cr-text-muted">{t('noBookings')}</p>
      ) : (
        <div className="overflow-x-auto rounded-cr-card border border-cr-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cr-surface-alt text-cr-text-muted">
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.customer')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.vehicle')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.dates')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.plan')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.total')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.status')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => (
                <tr key={b.id} className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}>
                  <td className="px-cr-md py-cr-sm text-cr-text font-medium">{b.customerName}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{b.vehicle.name}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted whitespace-nowrap">
                    {b.startDate} {t('dateSeparator')} {b.endDate}
                  </td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{t(`plan.${b.plan}`)}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text font-medium">
                    {b.currency} {b.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-cr-md py-cr-sm">
                    <StatusChip status={b.status} label={t(`status.${b.status}`)} />
                  </td>
                  <td className="px-cr-md py-cr-sm">
                    <Link
                      href={`/${locale}/dashboard/bookings/${b.id}`}
                      className="text-cr-primary text-sm font-semibold hover:underline"
                    >
                      {t('view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
