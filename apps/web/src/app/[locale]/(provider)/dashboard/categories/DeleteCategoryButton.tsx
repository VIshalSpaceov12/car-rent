'use client';
import { useTranslations } from 'next-intl';
import { deleteCategory } from './actions';

export function DeleteCategoryButton({
  locale,
  id,
}: {
  locale: string;
  id: string;
}) {
  const t = useTranslations('categories');

  async function handleDelete() {
    if (!window.confirm(t('deleteConfirm'))) return;
    await deleteCategory(locale, id);
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
