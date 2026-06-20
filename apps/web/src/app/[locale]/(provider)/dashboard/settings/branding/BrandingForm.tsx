'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface BrandingFormProps {
  initialPrimary: string;
  initialPrimaryDark: string;
}

export function BrandingForm({ initialPrimary, initialPrimaryDark }: BrandingFormProps) {
  const t = useTranslations('branding');
  const [primary, setPrimary] = useState(initialPrimary);
  const [primaryDark, setPrimaryDark] = useState(initialPrimaryDark);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch('/api/provider/branding', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ primary, primaryDark }),
      });
      if (res.ok) {
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-cr-lg max-w-sm">
      <div className="flex flex-col gap-cr-sm">
        <label htmlFor="primary" className="text-sm font-medium text-cr-text">
          {t('primaryColor')}
        </label>
        <div className="flex items-center gap-cr-sm">
          <input
            id="primary"
            type="color"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded-cr-sm border border-cr-border"
          />
          <input
            type="text"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            pattern="^#[0-9A-Fa-f]{6}$"
            className="flex-1 rounded-cr-sm border border-cr-border px-cr-sm py-cr-xs text-sm text-cr-text bg-cr-surface"
          />
        </div>
      </div>

      <div className="flex flex-col gap-cr-sm">
        <label htmlFor="primaryDark" className="text-sm font-medium text-cr-text">
          {t('primaryDarkColor')}
        </label>
        <div className="flex items-center gap-cr-sm">
          <input
            id="primaryDark"
            type="color"
            value={primaryDark}
            onChange={(e) => setPrimaryDark(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded-cr-sm border border-cr-border"
          />
          <input
            type="text"
            value={primaryDark}
            onChange={(e) => setPrimaryDark(e.target.value)}
            pattern="^#[0-9A-Fa-f]{6}$"
            className="flex-1 rounded-cr-sm border border-cr-border px-cr-sm py-cr-xs text-sm text-cr-text bg-cr-surface"
          />
        </div>
      </div>

      {/* Live preview swatch */}
      <div className="flex gap-cr-sm items-center">
        <span
          className="h-8 w-8 rounded-full border border-cr-border"
          style={{ backgroundColor: primary }}
          aria-hidden="true"
        />
        <span
          className="h-8 w-8 rounded-full border border-cr-border"
          style={{ backgroundColor: primaryDark }}
          aria-hidden="true"
        />
        <span className="text-sm text-cr-text-muted">{t('preview')}</span>
      </div>

      <button
        type="submit"
        disabled={status === 'saving'}
        className="rounded-cr-sm px-cr-lg py-cr-sm text-sm font-semibold text-white transition"
        style={{ backgroundColor: 'var(--color-primary)', opacity: status === 'saving' ? 0.7 : 1 }}
      >
        {status === 'saving' ? t('saving') : t('save')}
      </button>

      {status === 'saved' && (
        <p className="text-sm text-cr-success">{t('saved')}</p>
      )}
      {status === 'error' && (
        <p className="text-sm text-cr-danger">{t('errorSave')}</p>
      )}
    </form>
  );
}
