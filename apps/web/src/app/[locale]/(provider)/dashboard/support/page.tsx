import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { supportStatusFromDb } from '@car-rental/types';
import { StatusChip } from '@/ui/StatusChip';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function SupportPage({
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

  const t = await getTranslations('support');

  const tickets = await prisma.supportTicket.findMany({
    where: tenantScope(user),
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-lg">{t('title')}</h1>

      {tickets.length === 0 ? (
        <p className="text-cr-text-muted">{t('noTickets')}</p>
      ) : (
        <div className="overflow-x-auto rounded-cr-card border border-cr-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cr-surface-alt text-cr-text-muted">
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.subject')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.customer')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.status')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.date')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket, i) => {
                const status = supportStatusFromDb(ticket.status);
                return (
                  <tr
                    key={ticket.id}
                    className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}
                  >
                    <td className="px-cr-md py-cr-sm font-medium text-cr-text max-w-xs truncate">
                      {ticket.subject}
                    </td>
                    <td className="px-cr-md py-cr-sm text-cr-text-muted">{ticket.user.name}</td>
                    <td className="px-cr-md py-cr-sm">
                      <StatusChip
                        status={status === 'open' ? 'reserved' : 'completed'}
                        label={t(`status.${status}`)}
                      />
                    </td>
                    <td className="px-cr-md py-cr-sm text-cr-text-muted">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-cr-md py-cr-sm">
                      <Link
                        href={`/${locale}/dashboard/support/${ticket.id}`}
                        className="text-cr-primary text-sm font-semibold hover:underline"
                      >
                        {t('view')}
                      </Link>
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
