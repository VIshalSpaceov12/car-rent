import { redirect, notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { vehicleToDTO, categoryToDTO, branchToDTO } from '@/server/mappers';
import { VehicleForm } from '../../VehicleForm';
import { updateVehicle } from '../../actions';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function EditVehiclePage({
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

  const [vehicle, cats, branches] = await Promise.all([
    prisma.vehicle.findFirst({ where: { id, ...tenantScope(user) } }),
    prisma.vehicleCategory.findMany({ where: tenantScope(user), orderBy: { name: 'asc' } }),
    prisma.branch.findMany({ where: tenantScope(user), orderBy: { name: 'asc' } }),
  ]);

  if (!vehicle) notFound();

  const t = await getTranslations('fleet.form');

  const boundAction = updateVehicle.bind(null, locale, id);

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-lg">{t('titleEdit')}</h1>
      <VehicleForm
        locale={locale}
        categories={cats.map(categoryToDTO)}
        branches={branches.map(branchToDTO)}
        vehicle={vehicleToDTO(vehicle)}
        action={boundAction}
        isNew={false}
      />
    </main>
  );
}
