import { redirect } from 'next/navigation';
import { verifySession, requireRole } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { ProvidersClient } from './ProvidersClient';

export default async function AdminProvidersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  try {
    requireRole(user, 'admin');
  } catch {
    redirect(`/${locale}/login`);
  }

  const providers = await prisma.provider.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, vehicles: true, bookings: true } },
    },
  });

  const rows = providers.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    counts: {
      users: p._count.users,
      vehicles: p._count.vehicles,
      bookings: p._count.bookings,
    },
  }));

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <ProvidersClient initialProviders={rows} locale={locale} />
    </main>
  );
}
