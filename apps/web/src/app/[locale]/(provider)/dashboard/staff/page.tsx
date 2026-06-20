import { redirect } from 'next/navigation';
import { verifySession, requireRole } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { StaffClient } from './StaffClient';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function StaffPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  try {
    // Only provider (not staff) can manage staff
    requireRole(user, 'provider', 'admin');
  } catch {
    redirect(wrongRoleTarget(user.role, locale));
  }
  if (user.role !== 'admin' && !user.providerId) redirect(wrongRoleTarget(user.role, locale));

  const staffList = await prisma.user.findMany({
    where: { role: 'STAFF', providerId: user.providerId! },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const staff = staffList.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <StaffClient initialStaff={staff} />
    </main>
  );
}
