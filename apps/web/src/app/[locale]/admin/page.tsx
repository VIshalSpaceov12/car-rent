import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession } from '@/server/auth/dal';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') {
    if (user.role === 'provider' || user.role === 'staff') redirect(`/${locale}/dashboard`);
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations('admin');

  const sections = [
    { href: `/${locale}/admin/providers`, label: t('providers.title'), desc: t('providers.onboard') },
    { href: `/${locale}/admin/analytics`, label: t('analytics.title'), desc: t('analytics.topProviders') },
    { href: `/${locale}/admin/settings`, label: t('settings.title'), desc: t('settings.platformName') },
  ];

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-sm">{t('title')}</h1>
      <p className="text-cr-text-muted mb-cr-lg text-sm">{user.email}</p>
      <nav className="grid grid-cols-1 gap-cr-md sm:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex flex-col gap-cr-xs rounded-cr-card border border-cr-border bg-cr-surface p-cr-lg hover:bg-cr-surface-alt transition"
          >
            <span className="text-lg font-semibold text-cr-text">{s.label}</span>
            <span className="text-sm text-cr-text-muted">{s.desc}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
