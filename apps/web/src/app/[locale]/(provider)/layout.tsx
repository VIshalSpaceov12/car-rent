import 'server-only';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { verifySession } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { DEFAULT_PRIMARY, DEFAULT_PRIMARY_DARK } from '@/lib/brandDefaults';
import { createTheme, cssVarBlock } from '@car-rental/tokens/server';

export default async function ProviderLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'provider' && user.role !== 'staff') {
    if (user.role === 'admin') redirect(`/${locale}/admin`);
    redirect(`/${locale}/login`);
  }

  // Resolve provider brand colors for this tenant
  let primary = DEFAULT_PRIMARY;
  let primaryDark = DEFAULT_PRIMARY_DARK;

  if (user.providerId) {
    const provider = await prisma.provider.findUnique({
      where: { id: user.providerId },
      select: { colors: true },
    });
    const colors = provider?.colors as { primary?: string; primaryDark?: string } | null;
    if (colors?.primary) primary = colors.primary;
    if (colors?.primaryDark) primaryDark = colors.primaryDark;
  }

  const lightTheme = createTheme('light', { primary, primaryDark });
  const darkTheme = createTheme('dark', { primary, primaryDark });
  const brandCss = `:root { ${cssVarBlock(lightTheme)} } [data-theme="dark"] { ${cssVarBlock(darkTheme)} }`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      {children}
    </>
  );
}
