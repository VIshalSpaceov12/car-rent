import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { supportStatusFromDb } from '@car-rental/types';
import { StatusChip } from '@/ui/StatusChip';
import { SupportRespondClient } from './SupportRespondClient';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function SupportTicketPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    redirect(wrongRoleTarget(user.role, locale));
  }
  if (user.role !== 'admin' && !user.providerId) redirect(wrongRoleTarget(user.role, locale));

  const t = await getTranslations('support');

  const ticket = await prisma.supportTicket.findFirst({
    where: { id, providerId: user.providerId! },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!ticket) notFound();

  const status = supportStatusFromDb(ticket.status);

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl max-w-2xl">
      <a
        href={`/${locale}/dashboard/support`}
        className="text-cr-primary text-sm font-semibold hover:underline mb-cr-md inline-block"
      >
        {t('backToList')}
      </a>

      <div className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-md">
        <div className="flex items-start justify-between gap-cr-md flex-wrap mb-cr-sm">
          <h1 className="text-xl font-bold text-cr-text">{ticket.subject}</h1>
          <StatusChip
            status={status === 'open' ? 'reserved' : 'completed'}
            label={t(`status.${status}`)}
          />
        </div>
        <p className="text-xs text-cr-text-muted mb-cr-sm">
          {ticket.user.name} · {ticket.user.email} · {new Date(ticket.createdAt).toLocaleString(locale)}
        </p>
        <p className="text-sm text-cr-text whitespace-pre-wrap">{ticket.body}</p>
      </div>

      {ticket.response && (
        <div className="rounded-cr-card border border-cr-border bg-cr-surface-alt p-cr-md mb-cr-md">
          <p className="text-xs font-semibold text-cr-text-muted mb-cr-xs">{t('response')}</p>
          <p className="text-sm text-cr-text whitespace-pre-wrap">{ticket.response}</p>
        </div>
      )}

      <SupportRespondClient
        ticketId={ticket.id}
        isResolved={status === 'resolved'}
        existingResponse={ticket.response ?? undefined}
        locale={locale}
      />
    </main>
  );
}
