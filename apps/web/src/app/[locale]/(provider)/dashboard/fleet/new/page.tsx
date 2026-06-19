import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { categoryToDTO, branchToDTO } from '@/server/mappers';
import { VehicleForm } from '../VehicleForm';
import { createVehicle } from '../actions';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function NewVehiclePage({
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

  const [cats, branches] = await Promise.all([
    prisma.vehicleCategory.findMany({ where: tenantScope(user), orderBy: { name: 'asc' } }),
    prisma.branch.findMany({ where: tenantScope(user), orderBy: { name: 'asc' } }),
  ]);

  const t = await getTranslations('fleet.form');

  const boundAction = createVehicle.bind(null, locale);

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-lg">{t('titleNew')}</h1>
      <VehicleForm
        locale={locale}
        categories={cats.map(categoryToDTO)}
        branches={branches.map(branchToDTO)}
        action={boundAction}
        isNew
      />
    </main>
  );
}
