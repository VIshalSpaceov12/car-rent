import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { categoryToDTO } from '@/server/mappers';
import { AddCategoryForm } from './AddCategoryForm';
import { DeleteCategoryButton } from './DeleteCategoryButton';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function CategoriesPage({
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

  const cats = await prisma.vehicleCategory.findMany({
    where: tenantScope(user),
    orderBy: { name: 'asc' },
  });

  const t = await getTranslations('categories');
  const dtos = cats.map(categoryToDTO);

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-lg">{t('title')}</h1>

      <AddCategoryForm locale={locale} />

      <div className="mt-cr-lg overflow-x-auto rounded-cr-card border border-cr-border">
        {dtos.length === 0 ? (
          <p className="text-cr-text-muted px-cr-md py-cr-md">{t('noCategories')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cr-surface-alt text-cr-text-muted">
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.name')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.slug')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {dtos.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}>
                  <td className="px-cr-md py-cr-sm text-cr-text font-medium">{c.name}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{c.slug}</td>
                  <td className="px-cr-md py-cr-sm">
                    <DeleteCategoryButton locale={locale} id={c.id} />
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
