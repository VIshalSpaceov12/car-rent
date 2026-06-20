'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/Button';

interface Props {
  ticketId: string;
  isResolved: boolean;
  existingResponse?: string;
  locale: string;
}

export function SupportRespondClient({ ticketId, isResolved, existingResponse, locale }: Props) {
  const t = useTranslations('support');
  const [response, setResponse] = useState(existingResponse ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(isResolved);

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/provider/support/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response, status: 'resolved' }),
      });
      if (!res.ok) {
        setError(t('errorSave'));
        return;
      }
      setDone(true);
    } catch {
      setError(t('errorSave'));
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mt-cr-md rounded-cr-card border border-cr-border bg-cr-surface p-cr-md">
        <p className="text-sm text-cr-text-muted">{t('alreadyResolved')}</p>
        {response && (
          <p className="mt-cr-sm text-sm text-cr-text">{response}</p>
        )}
        <a
          href={`/${locale}/dashboard/support`}
          className="mt-cr-md inline-block text-cr-primary text-sm font-semibold hover:underline"
        >
          {t('backToList')}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleResolve} className="mt-cr-md flex flex-col gap-cr-sm max-w-lg">
      <label className="text-sm font-medium text-cr-text">{t('response')}</label>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder={t('responsePlaceholder')}
        rows={4}
        required
        className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-sm text-cr-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-y"
      />
      {error && <p className="text-cr-danger text-sm">{error}</p>}
      <div className="flex gap-cr-md">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? t('resolving') : t('resolve')}
        </Button>
        <a
          href={`/${locale}/dashboard/support`}
          className="inline-flex items-center text-sm text-cr-text-muted hover:underline"
        >
          {t('backToList')}
        </a>
      </div>
    </form>
  );
}
