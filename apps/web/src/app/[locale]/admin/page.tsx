import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession } from '@/server/auth/dal';

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'provider' || role === 'staff') return `/${locale}/dashboard`;
  return `/${locale}/login`;
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'admin') redirect(wrongRoleTarget(user.role, locale));

  const t = await getTranslations('admin');
  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg">
      <h1 className="text-2xl font-bold text-cr-text">{t('title')}</h1>
      <p className="text-cr-text-muted">{t('soon')}</p>
    </main>
  );
}
