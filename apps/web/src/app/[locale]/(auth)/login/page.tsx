'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { loginAction } from './actions';
import { Button } from '@/ui/Button';

export default function LoginPage() {
  const t = useTranslations('auth');
  const { locale } = useParams<{ locale: string }>();
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-cr-md px-cr-md">
      <h1 className="text-3xl font-extrabold text-cr-text">{t('signIn')}</h1>
      <form action={action} className="flex flex-col gap-cr-sm">
        <input type="hidden" name="locale" value={locale} />
        <input
          name="email"
          type="email"
          placeholder={t('email')}
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm"
        />
        <input
          name="password"
          type="password"
          placeholder={t('password')}
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm"
        />
        {state?.error && (
          <p className="text-cr-danger text-xs font-semibold">{t('invalid')}</p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? t('signingIn') : t('signIn')}
        </Button>
      </form>
    </main>
  );
}
