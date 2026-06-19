'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/StatusChip';
import type { DiscountCodeDTO } from '@car-rental/types';

interface Props {
  initialDiscounts: DiscountCodeDTO[];
}

export function DiscountsClient({ initialDiscounts }: Props) {
  const t = useTranslations('discounts');
  const [discounts, setDiscounts] = useState<DiscountCodeDTO[]>(initialDiscounts);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch('/api/provider/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          kind,
          value: Number(value),
          active: true,
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        }),
      });
      if (!res.ok) {
        setFormError(t('form.errorSave'));
        return;
      }
      const created: DiscountCodeDTO = await res.json();
      setDiscounts((prev) => [created, ...prev]);
      setShowForm(false);
      setCode('');
      setKind('percent');
      setValue('');
      setExpiresAt('');
    } catch {
      setFormError(t('form.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(discount: DiscountCodeDTO) {
    setTogglingId(discount.id);
    try {
      const res = await fetch(`/api/provider/discounts/${discount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !discount.active }),
      });
      if (res.ok) {
        const updated: DiscountCodeDTO = await res.json();
        setDiscounts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      }
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-cr-lg gap-cr-md flex-wrap">
        <h1 className="text-2xl font-bold text-cr-text">{t('title')}</h1>
        {!showForm && (
          <Button variant="primary" onClick={() => setShowForm(true)}>
            {t('addCode')}
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-lg max-w-lg">
          <h2 className="text-base font-semibold text-cr-text mb-cr-md">{t('form.title')}</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-cr-sm">
            <div className="flex flex-col gap-cr-xs">
              <label className="text-sm font-medium text-cr-text">{t('form.code')}</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t('form.codePlaceholder')}
                required
                className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-sm text-cr-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <span className="text-xs text-cr-text-muted">{t('form.codeHint')}</span>
            </div>

            <div className="flex flex-col gap-cr-xs">
              <label className="text-sm font-medium text-cr-text">{t('form.kind')}</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as 'percent' | 'fixed')}
                className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-sm text-cr-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="percent">{t('form.kindPercent')}</option>
                <option value="fixed">{t('form.kindFixed')}</option>
              </select>
            </div>

            <div className="flex flex-col gap-cr-xs">
              <label className="text-sm font-medium text-cr-text">{t('form.value')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-sm text-cr-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div className="flex flex-col gap-cr-xs">
              <label className="text-sm font-medium text-cr-text">{t('form.expiresAt')}</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-sm text-cr-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {formError && <p className="text-cr-danger text-sm">{formError}</p>}

            <div className="flex gap-cr-md mt-cr-xs">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? t('form.adding') : t('form.add')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
              >
                {t('form.cancel')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {discounts.length === 0 ? (
        <p className="text-cr-text-muted">{t('noDiscounts')}</p>
      ) : (
        <div className="overflow-x-auto rounded-cr-card border border-cr-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cr-surface-alt text-cr-text-muted">
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.code')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.kind')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.value')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.status')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.expires')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d, i) => (
                <tr
                  key={d.id}
                  className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}
                >
                  <td className="px-cr-md py-cr-sm font-mono font-semibold text-cr-text">{d.code}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{t(`kind.${d.kind}`)}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text">
                    {d.kind === 'percent' ? `${d.value}%` : `$${d.value}`}
                  </td>
                  <td className="px-cr-md py-cr-sm">
                    <StatusChip
                      status={d.active ? 'confirmed' : 'cancelled'}
                      label={d.active ? t('active') : t('inactive')}
                    />
                  </td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">
                    {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : t('never')}
                  </td>
                  <td className="px-cr-md py-cr-sm">
                    <button
                      onClick={() => handleToggle(d)}
                      disabled={togglingId === d.id}
                      className="text-cr-primary text-sm font-semibold hover:underline disabled:opacity-50"
                    >
                      {d.active ? t('deactivate') : t('activate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
