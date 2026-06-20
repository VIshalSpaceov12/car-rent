'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/Button';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface Props {
  initialStaff: StaffMember[];
  locale: string;
}

function randomPassword(len = 12): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function StaffClient({ initialStaff, locale }: Props) {
  const t = useTranslations('staff');
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const tempPass = randomPassword();
    try {
      const res = await fetch('/api/provider/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: tempPass }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err?.error === 'email_taken') {
          setFormError(t('form.errorEmailTaken'));
        } else {
          setFormError(t('form.errorSave'));
        }
        return;
      }
      const created: StaffMember = await res.json();
      setStaff((prev) => [created, ...prev]);
      setCreatedPassword(tempPass);
      setName('');
      setEmail('');
    } catch {
      setFormError(t('form.errorSave'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm(t('deactivateConfirm'))) return;
    setDeactivatingId(id);
    try {
      await fetch(`/api/provider/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate' }),
      });
      setStaff((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeactivatingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-cr-lg gap-cr-md flex-wrap">
        <h1 className="text-2xl font-bold text-cr-text">{t('title')}</h1>
        {!showForm && !createdPassword && (
          <Button variant="primary" onClick={() => setShowForm(true)}>
            {t('addStaff')}
          </Button>
        )}
      </div>

      {createdPassword && (
        <div className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-lg max-w-lg">
          <p className="text-sm font-semibold text-cr-text mb-cr-xs">{t('form.tempPassword')}</p>
          <p className="font-mono text-lg text-cr-primary mb-cr-xs select-all">{createdPassword}</p>
          <p className="text-xs text-cr-text-muted mb-cr-md">{t('form.tempPasswordHint')}</p>
          <Button
            variant="primary"
            onClick={() => {
              setCreatedPassword(null);
              setShowForm(false);
            }}
          >
            {t('form.done')}
          </Button>
        </div>
      )}

      {showForm && !createdPassword && (
        <div className="rounded-cr-card border border-cr-border bg-cr-surface p-cr-md mb-cr-lg max-w-lg">
          <h2 className="text-base font-semibold text-cr-text mb-cr-md">{t('form.title')}</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-cr-sm">
            <div className="flex flex-col gap-cr-xs">
              <label className="text-sm font-medium text-cr-text">{t('form.name')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm text-sm text-cr-text focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="flex flex-col gap-cr-xs">
              <label className="text-sm font-medium text-cr-text">{t('form.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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

      {staff.length === 0 ? (
        <p className="text-cr-text-muted">{t('noStaff')}</p>
      ) : (
        <div className="overflow-x-auto rounded-cr-card border border-cr-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cr-surface-alt text-cr-text-muted">
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.name')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.email')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.joined')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s, i) => (
                <tr
                  key={s.id}
                  className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}
                >
                  <td className="px-cr-md py-cr-sm font-medium text-cr-text">{s.name}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{s.email}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">
                    {new Date(s.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-cr-md py-cr-sm">
                    <button
                      onClick={() => handleDeactivate(s.id)}
                      disabled={deactivatingId === s.id}
                      className="text-cr-danger text-sm font-semibold hover:underline disabled:opacity-50"
                    >
                      {deactivatingId === s.id ? t('deactivating') : t('deactivate')}
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
