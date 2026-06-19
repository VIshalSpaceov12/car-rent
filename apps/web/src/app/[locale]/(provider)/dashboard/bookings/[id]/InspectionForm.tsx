'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/Button';
import type { ReturnCondition } from '@car-rental/types';
import { RETURN_CONDITIONS } from '@car-rental/types';

interface InspectionFormProps {
  inspectAction: (condition: ReturnCondition, notes: string) => Promise<{ error: string } | null>;
  errorLabels: Record<string, string>;
}

export function InspectionForm({ inspectAction, errorLabels }: InspectionFormProps) {
  const t = useTranslations('bookings.inspection');
  const [isPending, startTransition] = useTransition();
  const [condition, setCondition] = useState<ReturnCondition>('clean');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await inspectAction(condition, notes);
      if (result?.error) {
        setError(errorLabels[result.error] ?? result.error);
      }
    });
  }

  return (
    <section className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-md">
      <h2 className="text-sm font-semibold text-cr-text-muted uppercase mb-cr-sm">
        {t('sectionTitle')}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-cr-sm">
        {/* Condition select */}
        <div className="flex flex-col gap-cr-xs">
          <label
            htmlFor="condition"
            className="text-sm font-medium text-cr-text"
          >
            {t('conditionLabel')}
          </label>
          <select
            id="condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value as ReturnCondition)}
            disabled={isPending}
            className="rounded-cr-input border border-cr-border bg-cr-surface-alt text-cr-text px-cr-md py-cr-sm text-sm"
          >
            {RETURN_CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {t(`condition.${c}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Notes textarea */}
        <div className="flex flex-col gap-cr-xs">
          <label
            htmlFor="inspection-notes"
            className="text-sm font-medium text-cr-text"
          >
            {t('notesLabel')}
          </label>
          <textarea
            id="inspection-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isPending}
            rows={3}
            placeholder={t('notesPlaceholder')}
            className="rounded-cr-input border border-cr-border bg-cr-surface-alt text-cr-text px-cr-md py-cr-sm text-sm resize-none"
          />
        </div>

        {error && (
          <p className="text-sm font-medium text-cr-danger">{error}</p>
        )}

        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </form>
    </section>
  );
}
