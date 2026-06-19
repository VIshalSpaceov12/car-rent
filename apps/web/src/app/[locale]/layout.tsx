import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { isValidLocale } from '@/i18n/request';
import { rootThemeCss } from '@/lib/theme-style';
import '../globals.css';

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const messages = await getMessages();
  return (
    <html lang={locale} dir={dir} data-theme="light">
      <head>
        <style dangerouslySetInnerHTML={{ __html: rootThemeCss }} />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
