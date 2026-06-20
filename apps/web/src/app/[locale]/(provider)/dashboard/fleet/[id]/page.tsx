import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { vehicleToDTO, categoryToDTO, branchToDTO } from '@/server/mappers';
import { VehicleForm } from '../VehicleForm';
import { updateVehicle } from '../actions';
import { MaintenanceClient } from './MaintenanceClient';
import type { MaintenanceRecordDTO } from '@car-rental/types';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function VehicleDetailPage({
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

  const [vehicle, cats, branches, maintenanceRaw] = await Promise.all([
    prisma.vehicle.findFirst({ where: { id, ...tenantScope(user) } }),
    prisma.vehicleCategory.findMany({ where: tenantScope(user), orderBy: { name: 'asc' } }),
    prisma.branch.findMany({ where: tenantScope(user), orderBy: { name: 'asc' } }),
    prisma.maintenanceRecord.findMany({
      where: { vehicleId: id, providerId: user.providerId! },
      orderBy: { date: 'desc' },
    }),
  ]);

  if (!vehicle) notFound();

  const tFleet = await getTranslations('fleet.form');
  const tFleetParent = await getTranslations('fleet');

  const maintenanceRecords: MaintenanceRecordDTO[] = maintenanceRaw.map((r) => ({
    id: r.id,
    providerId: r.providerId,
    vehicleId: r.vehicleId,
    description: r.description,
    date: r.date.toISOString().slice(0, 10),
    createdAt: r.createdAt.toISOString(),
    ...(r.cost !== null ? { cost: Number(r.cost) } : {}),
  }));

  const boundAction = updateVehicle.bind(null, locale, id);

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <div className="flex items-center gap-cr-md mb-cr-lg">
        <Link
          href={`/${locale}/dashboard/fleet`}
          className="text-cr-primary text-sm font-semibold hover:underline"
        >
          {tFleetParent('backToFleet')}
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-cr-text mb-cr-lg">{tFleet('titleEdit')}</h1>

      <VehicleForm
        locale={locale}
        categories={cats.map(categoryToDTO)}
        branches={branches.map(branchToDTO)}
        vehicle={vehicleToDTO(vehicle)}
        action={boundAction}
        isNew={false}
      />

      <MaintenanceClient vehicleId={id} initialRecords={maintenanceRecords} locale={locale} />
    </main>
  );
}
