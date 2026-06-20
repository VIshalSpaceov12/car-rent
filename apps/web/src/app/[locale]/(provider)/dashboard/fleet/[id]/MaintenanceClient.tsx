'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/Button';
import type { MaintenanceRecordDTO } from '@car-rental/types';

interface Props {
  vehicleId: string;
  initialRecords: MaintenanceRecordDTO[];
  locale: string;
}

export function MaintenanceClient({ vehicleId, initialRecords, locale }: Props) {
  const t = useTranslations('maintenance');
  const [records, setRecords] = useState<MaintenanceRecordDTO[]>(initialRecords);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/provider/vehicles/${vehicleId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          date,
          ...(cost ? { cost: Number(cost) } : {}),
        }),
      });
      if (!res.ok) {
        setFormError(t('form.errorSave'));
        return;
      }
      const created: MaintenanceRecordDTO = await res.json();
      setRecords((prev) => [created, ...prev]);
      setShowForm(false);
      setDescription('');
      setCost('');
      setDate(new Date().toISOString().slice(0, 10));
    } catch {
      setFormError(t('form.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-cr-lg">
      <div className="flex items-center justify-between mb-cr-md gap-cr-md flex-wrap">
        <h2 className="text-lg font-semibold text-cr-text">{t('title')}</h2>
        {!showForm && (
          <Button variant="ghost" onClick={() => setShowForm(true)}>
            {t('addRecord')}
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-md max-w-lg">
          <h3 className="text-sm font-semibold text-cr-text mb-cr-sm">{t('form.title')}</h3>
          <form onSubmit={handleAdd} className="flex flex-col gap-cr-sm">
            <div className="flex flex-col gap-cr-xs">
              <label className="text-xs font-medium text-cr-text-muted">{t('form.date')}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-sm text-cr-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="flex flex-col gap-cr-xs">
              <label className="text-xs font-medium text-cr-text-muted">{t('form.description')}</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('form.descriptionPlaceholder')}
                required
                className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-sm text-cr-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="flex flex-col gap-cr-xs">
              <label className="text-xs font-medium text-cr-text-muted">{t('form.cost')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-sm text-cr-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            {formError && <p className="text-cr-danger text-xs">{formError}</p>}
            <div className="flex gap-cr-md">
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

      {records.length === 0 ? (
        <p className="text-cr-text-muted text-sm">{t('noRecords')}</p>
      ) : (
        <div className="overflow-x-auto rounded-cr-card border border-cr-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cr-surface-alt text-cr-text-muted">
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.date')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.description')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.cost')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted whitespace-nowrap">{r.date}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text">{r.description}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text">
                    {r.cost !== undefined
                      ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(r.cost)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
