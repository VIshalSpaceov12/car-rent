'use client';
import { useTranslations } from 'next-intl';
import { deleteBranch } from './actions';

export function DeleteBranchButton({
  locale,
  id,
}: {
  locale: string;
  id: string;
}) {
  const t = useTranslations('branches');

  async function handleDelete() {
    if (!window.confirm(t('deleteConfirm'))) return;
    await deleteBranch(locale, id);
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-cr-danger text-sm font-semibold hover:underline"
    >
      {t('delete')}
    </button>
  );
}
