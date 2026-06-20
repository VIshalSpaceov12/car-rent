import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function CustomersPage({
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

  const t = await getTranslations('customers');

  const scope = tenantScope(user);
  const bookingAgg = await prisma.booking.groupBy({
    by: ['customerId'],
    where: scope,
    _count: { customerId: true },
  });

  const customerIds = bookingAgg.map((b) => b.customerId);
  const customers =
    customerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: customerIds }, role: 'CUSTOMER' },
          select: { id: true, name: true, email: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];

  const countMap = new Map(bookingAgg.map((b) => [b.customerId, b._count.customerId]));

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-lg">{t('title')}</h1>

      {customers.length === 0 ? (
        <p className="text-cr-text-muted">{t('noCustomers')}</p>
      ) : (
        <div className="overflow-x-auto rounded-cr-card border border-cr-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cr-surface-alt text-cr-text-muted">
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.name')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.email')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.bookings')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.joined')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr
                  key={c.id}
                  className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}
                >
                  <td className="px-cr-md py-cr-sm font-medium text-cr-text">{c.name}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{c.email}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text">{countMap.get(c.id) ?? 0}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">
                    {new Date(c.createdAt).toLocaleDateString(locale)}
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
