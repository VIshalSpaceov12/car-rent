'use client';
import { useTranslations } from 'next-intl';
import { deleteVehicle } from './actions';

export function DeleteVehicleButton({
  locale,
  id,
}: {
  locale: string;
  id: string;
}) {
  const t = useTranslations('fleet');

  async function handleDelete() {
    if (!window.confirm(t('deleteConfirm'))) return;
    await deleteVehicle(locale, id);
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
