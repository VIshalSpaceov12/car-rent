'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/Button';

interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultLocale: string;
}

interface Props {
  initial: PlatformSettings;
}

export function SettingsClient({ initial }: Props) {
  const t = useTranslations('admin.settings');

  const [platformName, setPlatformName] = useState(initial.platformName);
  const [supportEmail, setSupportEmail] = useState(initial.supportEmail);
  const [defaultLocale, setDefaultLocale] = useState(initial.defaultLocale.toUpperCase());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformName,
          supportEmail,
          defaultLocale: defaultLocale as 'EN' | 'AR',
        }),
      });
      if (!res.ok) {
        setError(t('errorSave'));
        return;
      }
      setSaved(true);
    } catch {
      setError(t('errorSave'));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-sm text-cr-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-full';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-cr-sm max-w-lg">
      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-medium text-cr-text">{t('platformName')}</label>
        <input
          type="text"
          value={platformName}
          onChange={(e) => setPlatformName(e.target.value)}
          required
          maxLength={100}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-medium text-cr-text">{t('supportEmail')}</label>
        <input
          type="email"
          value={supportEmail}
          onChange={(e) => setSupportEmail(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-medium text-cr-text">{t('defaultLocale')}</label>
        <select
          value={defaultLocale}
          onChange={(e) => setDefaultLocale(e.target.value)}
          className={inputClass}
        >
          <option value="EN">EN</option>
          <option value="AR">AR</option>
        </select>
      </div>

      {error && <p className="text-cr-danger text-sm">{error}</p>}
      {saved && (
        <p className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>
          {t('saved')}
        </p>
      )}

      <div className="mt-cr-xs">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
