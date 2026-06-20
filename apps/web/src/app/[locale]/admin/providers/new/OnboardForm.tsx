'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/Button';
import { DEFAULT_PRIMARY, DEFAULT_PRIMARY_DARK } from '@/lib/brandDefaults';

interface Props {
  locale: string;
}

interface CreatedProvider {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export function OnboardForm({ locale }: Props) {
  const t = useTranslations('admin.providers');

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [primaryDarkColor, setPrimaryDarkColor] = useState(DEFAULT_PRIMARY_DARK);
  const [defaultLocale, setDefaultLocale] = useState<'EN' | 'AR'>('EN');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedProvider | null>(null);

  function autoSlug(val: string) {
    return val
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          colors: { primary: primaryColor, primaryDark: primaryDarkColor },
          defaultLocale,
          ownerName,
          ownerEmail,
          ownerPassword,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err?.error === 'slug_taken') {
          setError(t('form.errorSlugTaken'));
        } else if (err?.error === 'email_taken') {
          setError(t('form.errorEmailTaken'));
        } else {
          setError(t('form.errorSave'));
        }
        return;
      }
      const data: CreatedProvider = await res.json();
      setCreated(data);
    } catch {
      setError(t('form.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-sm text-cr-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-full';

  if (created) {
    return (
      <div className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-lg max-w-lg">
        <h2 className="text-lg font-bold text-cr-primary mb-cr-sm">{created.name}</h2>
        <p className="text-sm text-cr-text-muted mb-cr-xs">
          {t('form.createdSlug')}: <span className="font-mono text-cr-text">{created.slug}</span>
        </p>
        <p className="text-sm text-cr-text-muted mb-cr-lg">
          {t('form.createdStatus')}: <span className="font-semibold text-cr-text">{created.status}</span>
        </p>
        <a
          href={`/${locale}/admin/providers`}
          className="text-sm font-semibold text-cr-primary hover:underline"
        >
          ← {t('title')}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-cr-sm max-w-lg">
      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-medium text-cr-text">{t('form.name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slug) setSlug(autoSlug(e.target.value));
          }}
          required
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-medium text-cr-text">{t('form.slug')}</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          pattern="[a-z0-9-]+"
          className={inputClass}
        />
        <span className="text-xs text-cr-text-muted">{t('form.slugHint')}</span>
      </div>

      <div className="flex gap-cr-md">
        <div className="flex flex-col gap-cr-xs flex-1">
          <label className="text-sm font-medium text-cr-text">{t('form.primaryColor')}</label>
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-full rounded-cr-input border border-cr-border bg-cr-surface cursor-pointer"
          />
        </div>
        <div className="flex flex-col gap-cr-xs flex-1">
          <label className="text-sm font-medium text-cr-text">{t('form.primaryDarkColor')}</label>
          <input
            type="color"
            value={primaryDarkColor}
            onChange={(e) => setPrimaryDarkColor(e.target.value)}
            className="h-10 w-full rounded-cr-input border border-cr-border bg-cr-surface cursor-pointer"
          />
        </div>
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-medium text-cr-text">{t('form.defaultLocale')}</label>
        <select
          value={defaultLocale}
          onChange={(e) => setDefaultLocale(e.target.value as 'EN' | 'AR')}
          className={inputClass}
        >
          <option value="EN">EN</option>
          <option value="AR">AR</option>
        </select>
      </div>

      <hr className="border-cr-border my-cr-xs" />

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-medium text-cr-text">{t('form.ownerName')}</label>
        <input
          type="text"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-medium text-cr-text">{t('form.ownerEmail')}</label>
        <input
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-cr-xs">
        <label className="text-sm font-medium text-cr-text">{t('form.ownerPassword')}</label>
        <input
          type="password"
          value={ownerPassword}
          onChange={(e) => setOwnerPassword(e.target.value)}
          required
          minLength={8}
          className={inputClass}
        />
      </div>

      {error && <p className="text-cr-danger text-sm">{error}</p>}

      <div className="flex gap-cr-md mt-cr-xs">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? t('form.saving') : t('form.save')}
        </Button>
        <a href={`/${locale}/admin/providers`}>
          <Button type="button" variant="ghost">
            {t('form.cancel')}
          </Button>
        </a>
      </div>
    </form>
  );
}
