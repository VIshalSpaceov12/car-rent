import { getRequestConfig } from 'next-intl/server';

const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const defaultLocale: Locale = 'en';

export function isValidLocale(locale: string | undefined): locale is Locale {
  return LOCALES.includes(locale as Locale);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = isValidLocale(requested) ? requested : defaultLocale;
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
