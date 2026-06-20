import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession, requireRole } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { SettingsClient } from './SettingsClient';

export default async function AdminSettingsPage({
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

  const t = await getTranslations('admin.settings');

  // Upsert to ensure the singleton always exists
  const settings = await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      platformName: 'Car Rental Platform',
      supportEmail: 'support@platform.test',
      defaultLocale: 'EN',
    },
  });

  const initial = {
    platformName: settings.platformName,
    supportEmail: settings.supportEmail,
    defaultLocale: settings.defaultLocale.toLowerCase(),
  };

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg pb-cr-xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-lg">{t('title')}</h1>
      <SettingsClient initial={initial} />
    </main>
  );
}
