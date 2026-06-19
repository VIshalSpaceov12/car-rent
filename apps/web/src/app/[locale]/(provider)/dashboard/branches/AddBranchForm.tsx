'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/Button';
import { createBranch } from './actions';

export function AddBranchForm({ locale }: { locale: string }) {
  const t = useTranslations('branches');
  const boundAction = createBranch.bind(null, locale);
  const [state, formAction, pending] = useActionState(boundAction, null);

  return (
    <form action={formAction} className="flex flex-wrap gap-cr-md items-end">
      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-semibold text-cr-text">{t('form.name')}</label>
        <input
          name="name"
          required
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
        />
      </div>
      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-semibold text-cr-text">{t('form.address')}</label>
        <input
          name="address"
          required
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
        />
      </div>
      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-semibold text-cr-text">{t('form.phone')}</label>
        <input
          name="phone"
          type="tel"
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
        />
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? t('form.adding') : t('form.add')}
      </Button>
      {state?.error && (
        <p className="text-cr-danger text-sm font-semibold w-full">{t('form.errorSave')}</p>
      )}
    </form>
  );
}
