'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/Button';
import { createCategory } from './actions';

export function AddCategoryForm({ locale }: { locale: string }) {
  const t = useTranslations('categories');
  const boundAction = createCategory.bind(null, locale);
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
        <label className="text-sm font-semibold text-cr-text">
          {t('form.slug')}
          <span className="ms-cr-xs text-cr-text-muted text-xs font-normal">{t('form.slugHint')}</span>
        </label>
        <input
          name="slug"
          required
          pattern="[a-z0-9-]+"
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
