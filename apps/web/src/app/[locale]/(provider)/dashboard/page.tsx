import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { verifySession } from '@/server/auth/dal';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'provider' && user.role !== 'staff') redirect(wrongRoleTarget(user.role, locale));

  const t = await getTranslations('dashboard');
  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-md">
        {t('title')} — {user.name}
      </h1>
      <nav className="flex flex-wrap gap-cr-md">
        <Link
          href={`/${locale}/dashboard/fleet`}
          className="flex flex-col gap-cr-sm rounded-cr-card border border-cr-border bg-cr-surface p-cr-lg min-w-[160px] hover:bg-cr-surface-alt transition"
        >
          <span className="text-lg font-semibold text-cr-text">{t('nav.fleet')}</span>
        </Link>
        <Link
          href={`/${locale}/dashboard/categories`}
          className="flex flex-col gap-cr-sm rounded-cr-card border border-cr-border bg-cr-surface p-cr-lg min-w-[160px] hover:bg-cr-surface-alt transition"
        >
          <span className="text-lg font-semibold text-cr-text">{t('nav.categories')}</span>
        </Link>
        <Link
          href={`/${locale}/dashboard/branches`}
          className="flex flex-col gap-cr-sm rounded-cr-card border border-cr-border bg-cr-surface p-cr-lg min-w-[160px] hover:bg-cr-surface-alt transition"
        >
          <span className="text-lg font-semibold text-cr-text">{t('nav.branches')}</span>
        </Link>
        <Link
          href={`/${locale}/dashboard/bookings`}
          className="flex flex-col gap-cr-sm rounded-cr-card border border-cr-border bg-cr-surface p-cr-lg min-w-[160px] hover:bg-cr-surface-alt transition"
        >
          <span className="text-lg font-semibold text-cr-text">{t('nav.bookings')}</span>
        </Link>
      </nav>
    </main>
  );
}
