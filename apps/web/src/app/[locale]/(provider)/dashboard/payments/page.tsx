import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { paymentToDTO } from '@/server/mappers';
import { StatusChip } from '@/ui/StatusChip';
import { RefundButton } from './RefundButton';
import { refundPayment } from './actions';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function PaymentsPage({
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

  const scope = tenantScope(user);

  const payments = await prisma.payment.findMany({
    where: scope,
    orderBy: { createdAt: 'desc' },
    include: {
      booking: {
        select: {
          id: true,
          customer: { select: { name: true, email: true } },
        },
      },
    },
  });

  const t = await getTranslations('payments');

  const errorLabels: Record<string, string> = {
    not_found: t('error.notFound'),
    forbidden: t('error.forbidden'),
    not_refundable: t('error.notRefundable'),
  };

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <div className="flex items-center justify-between mb-cr-lg gap-cr-md flex-wrap">
        <h1 className="text-2xl font-bold text-cr-text">{t('title')}</h1>
        <Link
          href={`/${locale}/dashboard`}
          className="text-cr-primary text-sm font-semibold hover:underline"
        >
          {t('backToDashboard')}
        </Link>
      </div>

      {payments.length === 0 ? (
        <p className="text-cr-text-muted">{t('noPayments')}</p>
      ) : (
        <div className="overflow-x-auto rounded-cr-card border border-cr-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cr-surface-alt text-cr-text-muted">
                <th className="px-cr-md py-cr-sm text-start font-semibold">
                  {t('columns.booking')}
                </th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">
                  {t('columns.customer')}
                </th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">
                  {t('columns.amount')}
                </th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">
                  {t('columns.method')}
                </th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">
                  {t('columns.status')}
                </th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">
                  {t('columns.date')}
                </th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">
                  {t('columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => {
                const dto = paymentToDTO(p);
                const bookingId = p.booking.id;
                const customerName = p.booking.customer.name;
                const customerEmail = p.booking.customer.email;
                const isPaid = dto.status === 'paid';

                return (
                  <tr
                    key={dto.id}
                    className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}
                  >
                    <td className="px-cr-md py-cr-sm">
                      <Link
                        href={`/${locale}/dashboard/bookings/${bookingId}`}
                        className="text-cr-primary font-semibold hover:underline font-mono text-xs"
                      >
                        {bookingId.slice(-8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-cr-md py-cr-sm">
                      <p className="text-cr-text font-medium">{customerName}</p>
                      <p className="text-cr-text-muted text-xs">{customerEmail}</p>
                    </td>
                    <td className="px-cr-md py-cr-sm text-cr-text font-semibold">
                      {dto.currency} {dto.amount.toFixed(2)}
                    </td>
                    <td className="px-cr-md py-cr-sm text-cr-text-muted capitalize">
                      {t(`method.${dto.method}`)}
                    </td>
                    <td className="px-cr-md py-cr-sm">
                      <StatusChip
                        status={dto.status}
                        label={t(`status.${dto.status}`)}
                      />
                    </td>
                    <td className="px-cr-md py-cr-sm text-cr-text-muted whitespace-nowrap">
                      {new Date(dto.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-cr-md py-cr-sm">
                      {isPaid && (
                        <RefundButton
                          label={t('refund')}
                          confirmLabel={t('refundConfirm')}
                          pendingLabel={t('refunding')}
                          errorLabels={errorLabels}
                          action={refundPayment.bind(null, locale, dto.id)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
