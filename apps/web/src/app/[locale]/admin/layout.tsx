import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession } from '@/server/auth/dal';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  const navLinks = [
    { href: `/${locale}/admin`, label: t('title') },
    { href: `/${locale}/admin/providers`, label: t('providers.title') },
    { href: `/${locale}/admin/analytics`, label: t('analytics.title') },
    { href: `/${locale}/admin/settings`, label: t('settings.title') },
  ];

  return (
    <div className="min-h-screen bg-cr-surface">
      <header
        className="border-b border-cr-border bg-cr-surface px-cr-lg py-cr-sm flex items-center gap-cr-lg"
        style={{ borderBottomColor: 'var(--color-border)' }}
      >
        <span className="font-bold text-cr-primary text-lg">{t('title')}</span>
        <nav className="flex gap-cr-md flex-wrap">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-cr-text-muted hover:text-cr-primary transition"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="max-w-screen-xl mx-auto">{children}</div>
    </div>
  );
}
