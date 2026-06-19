import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { branchToDTO } from '@/server/mappers';
import { AddBranchForm } from './AddBranchForm';
import { DeleteBranchButton } from './DeleteBranchButton';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function BranchesPage({
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

  const branches = await prisma.branch.findMany({
    where: tenantScope(user),
    orderBy: { name: 'asc' },
  });

  const t = await getTranslations('branches');
  const dtos = branches.map(branchToDTO);

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-lg">{t('title')}</h1>

      <AddBranchForm locale={locale} />

      <div className="mt-cr-lg overflow-x-auto rounded-cr-card border border-cr-border">
        {dtos.length === 0 ? (
          <p className="text-cr-text-muted px-cr-md py-cr-md">{t('noBranches')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cr-surface-alt text-cr-text-muted">
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.name')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.address')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.phone')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {dtos.map((b, i) => (
                <tr key={b.id} className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}>
                  <td className="px-cr-md py-cr-sm text-cr-text font-medium">{b.name}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{b.address}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{b.phone ?? '—'}</td>
                  <td className="px-cr-md py-cr-sm">
                    <DeleteBranchButton locale={locale} id={b.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
