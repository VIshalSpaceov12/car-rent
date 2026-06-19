import { redirect } from 'next/navigation';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { discountKindFromDb, type DiscountCodeDTO } from '@car-rental/types';
import { DiscountsClient } from './DiscountsClient';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function DiscountsPage({
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

  const raw = await prisma.discountCode.findMany({
    where: tenantScope(user),
    orderBy: { createdAt: 'desc' },
  });

  const discounts: DiscountCodeDTO[] = raw.map((d) => ({
    id: d.id,
    providerId: d.providerId,
    code: d.code,
    kind: discountKindFromDb(d.kind),
    value: Number(d.value),
    active: d.active,
    createdAt: d.createdAt.toISOString(),
    ...(d.expiresAt ? { expiresAt: d.expiresAt.toISOString() } : {}),
  }));

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <DiscountsClient initialDiscounts={discounts} />
    </main>
  );
}
