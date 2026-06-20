import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { verifySession } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { DEFAULT_PRIMARY, DEFAULT_PRIMARY_DARK } from '@/lib/brandDefaults';
import { BrandingForm } from './BrandingForm';

export default async function BrandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'provider' && user.role !== 'staff') redirect(`/${locale}/login`);
  if (!user.providerId) redirect(`/${locale}/login`);

  const provider = await prisma.provider.findUnique({
    where: { id: user.providerId },
    select: { name: true, colors: true },
  });
  const colors = provider?.colors as { primary?: string; primaryDark?: string } | null;

  const t = await getTranslations('branding');

  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg max-w-2xl">
      <h1 className="text-2xl font-bold text-cr-text mb-cr-sm">{t('title')}</h1>
      <p className="text-sm text-cr-text-muted mb-cr-lg">{t('subtitle')}</p>
      <BrandingForm
        initialPrimary={colors?.primary ?? DEFAULT_PRIMARY}
        initialPrimaryDark={colors?.primaryDark ?? DEFAULT_PRIMARY_DARK}
      />
    </main>
  );
}
