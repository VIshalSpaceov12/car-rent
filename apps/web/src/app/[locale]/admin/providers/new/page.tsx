import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole } from '@/server/auth/dal';
import { OnboardForm } from './OnboardForm';

export default async function AdminProviderNewPage({
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

  const t = await getTranslations('admin.providers');

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-lg">{t('form.title')}</h1>
      <OnboardForm locale={locale} />
    </main>
  );
}
