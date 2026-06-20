import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { vehicleToDTO } from '@/server/mappers';
import { StatusChip } from '@/ui/StatusChip';
import { Button } from '@/ui/Button';
import { DeleteVehicleButton } from './DeleteVehicleButton';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function FleetPage({
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

  const vehicles = await prisma.vehicle.findMany({
    where: tenantScope(user),
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  });

  const t = await getTranslations('fleet');
  const dtos = vehicles.map((v) => ({
    ...vehicleToDTO(v),
    categoryName: v.category.name,
  }));

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <div className="flex items-center justify-between mb-cr-lg gap-cr-md flex-wrap">
        <h1 className="text-2xl font-bold text-cr-text">{t('title')}</h1>
        <Link href={`/${locale}/dashboard/fleet/new`}>
          <Button variant="primary">{t('addVehicle')}</Button>
        </Link>
      </div>

      {dtos.length === 0 ? (
        <p className="text-cr-text-muted">{t('noVehicles')}</p>
      ) : (
        <div className="overflow-x-auto rounded-cr-card border border-cr-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cr-surface-alt text-cr-text-muted">
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.name')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.category')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.transmission')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.fuel')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.pricePerDay')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.status')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {dtos.map((v, i) => (
                <tr
                  key={v.id}
                  className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}
                >
                  <td className="px-cr-md py-cr-sm text-cr-text font-medium">{v.name}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{v.categoryName}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{t(`form.transmissions.${v.transmission}`)}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{t(`form.fuelTypes.${v.fuelType}`)}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text">{v.pricePerDay}</td>
                  <td className="px-cr-md py-cr-sm">
                    <StatusChip status={v.status} label={t(`form.statuses.${v.status}`)} />
                  </td>
                  <td className="px-cr-md py-cr-sm">
                    <div className="flex gap-cr-md items-center">
                      <Link
                        href={`/${locale}/dashboard/fleet/${v.id}/edit`}
                        className="text-cr-primary text-sm font-semibold hover:underline"
                      >
                        {t('edit')}
                      </Link>
                      <Link
                        href={`/${locale}/dashboard/fleet/${v.id}`}
                        className="text-cr-text-muted text-sm font-semibold hover:underline"
                      >
                        {t('maintenance')}
                      </Link>
                      <DeleteVehicleButton locale={locale} id={v.id} />
                    </div>
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
