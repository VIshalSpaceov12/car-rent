'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/ui/Button';
import type { VehicleCategoryDTO, BranchDTO, VehicleDTO } from '@car-rental/types';
import { TRANSMISSIONS, FUEL_TYPES, VEHICLE_STATUSES } from '@car-rental/types';

type Props = {
  locale: string;
  categories: VehicleCategoryDTO[];
  branches: BranchDTO[];
  vehicle?: VehicleDTO;
  action: (
    prev: { error?: string } | null,
    formData: FormData,
  ) => Promise<{ error?: string } | null>;
  isNew?: boolean;
};

export function VehicleForm({ locale, categories, branches, vehicle, action }: Props) {
  const t = useTranslations('fleet.form');
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-cr-md max-w-lg">
      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-semibold text-cr-text">{t('name')}</label>
        <input
          name="name"
          defaultValue={vehicle?.name}
          required
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
        />
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-semibold text-cr-text">{t('category')}</label>
        <select
          name="categoryId"
          defaultValue={vehicle?.categoryId}
          required
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
        >
          <option value="">{t('selectCategory')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-semibold text-cr-text">{t('branch')}</label>
        <select
          name="branchId"
          defaultValue={vehicle?.branchId ?? ''}
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
        >
          <option value="">{t('selectBranch')}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-cr-md">
        <div className="flex flex-col gap-cr-xs">
          <label className="text-sm font-semibold text-cr-text">{t('make')}</label>
          <input
            name="make"
            defaultValue={vehicle?.make}
            className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
          />
        </div>
        <div className="flex flex-col gap-cr-xs">
          <label className="text-sm font-semibold text-cr-text">{t('model')}</label>
          <input
            name="model"
            defaultValue={vehicle?.model}
            className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
          />
        </div>
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-semibold text-cr-text">{t('year')}</label>
        <input
          name="year"
          type="number"
          min={1900}
          max={2100}
          defaultValue={vehicle?.year}
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
        />
      </div>

      <div className="grid grid-cols-2 gap-cr-md">
        <div className="flex flex-col gap-cr-xs">
          <label className="text-sm font-semibold text-cr-text">{t('transmission')}</label>
          <select
            name="transmission"
            defaultValue={vehicle?.transmission}
            required
            className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
          >
            <option value="">{t('selectTransmission')}</option>
            {TRANSMISSIONS.map((tx) => (
              <option key={tx} value={tx}>{t(`transmissions.${tx}`)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-cr-xs">
          <label className="text-sm font-semibold text-cr-text">{t('fuelType')}</label>
          <select
            name="fuelType"
            defaultValue={vehicle?.fuelType}
            required
            className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
          >
            <option value="">{t('selectFuelType')}</option>
            {FUEL_TYPES.map((ft) => (
              <option key={ft} value={ft}>{t(`fuelTypes.${ft}`)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-semibold text-cr-text">{t('status')}</label>
        <select
          name="status"
          defaultValue={vehicle?.status ?? 'active'}
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
        >
          {VEHICLE_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`statuses.${s}`)}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-cr-md">
        <div className="flex flex-col gap-cr-xs">
          <label className="text-sm font-semibold text-cr-text">{t('pricePerDay')}</label>
          <input
            name="pricePerDay"
            type="number"
            min={0}
            step="0.01"
            defaultValue={vehicle?.pricePerDay}
            required
            className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
          />
        </div>
        <div className="flex flex-col gap-cr-xs">
          <label className="text-sm font-semibold text-cr-text">{t('seats')}</label>
          <input
            name="seats"
            type="number"
            min={1}
            defaultValue={vehicle?.seats}
            className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
          />
        </div>
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-semibold text-cr-text">{t('imageUrl')}</label>
        <input
          name="imageUrl"
          type="url"
          defaultValue={vehicle?.imageUrl}
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text"
        />
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-semibold text-cr-text">{t('description')}</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={vehicle?.description}
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-cr-text resize-none"
        />
      </div>

      {state?.error && (
        <p className="text-cr-danger text-sm font-semibold">{t('errorSave')}</p>
      )}

      <div className="flex gap-cr-md">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? t('saving') : t('save')}
        </Button>
        <Link href={`/${locale}/dashboard/fleet`}>
          <Button type="button" variant="ghost">{t('cancel')}</Button>
        </Link>
      </div>
    </form>
  );
}
