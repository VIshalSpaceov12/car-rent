'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/StatusChip';

interface ProviderRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  counts: { users: number; vehicles: number; bookings: number };
}

interface Props {
  initialProviders: ProviderRow[];
  locale: string;
}

export function ProvidersClient({ initialProviders, locale }: Props) {
  const t = useTranslations('admin.providers');
  const [providers, setProviders] = useState<ProviderRow[]>(initialProviders);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function patchStatus(id: string, status: 'active' | 'suspended') {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/providers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: updated.status } : p)),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-cr-lg gap-cr-md flex-wrap">
        <h1 className="text-2xl font-bold text-cr-text">{t('title')}</h1>
        <Link href={`/${locale}/admin/providers/new`}>
          <Button variant="primary">{t('onboard')}</Button>
        </Link>
      </div>

      {providers.length === 0 ? (
        <p className="text-cr-text-muted">{t('noProviders')}</p>
      ) : (
        <div className="overflow-x-auto rounded-cr-card border border-cr-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cr-surface-alt text-cr-text-muted">
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.name')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.slug')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.status')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.users')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.vehicles')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.bookings')}</th>
                <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p, i) => (
                <tr
                  key={p.id}
                  className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}
                >
                  <td className="px-cr-md py-cr-sm font-medium text-cr-text">{p.name}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted font-mono text-xs">{p.slug}</td>
                  <td className="px-cr-md py-cr-sm">
                    <StatusChip
                      status={p.status}
                      label={t(`status.${p.status}` as 'status.active' | 'status.suspended' | 'status.pending')}
                    />
                  </td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{p.counts.users}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{p.counts.vehicles}</td>
                  <td className="px-cr-md py-cr-sm text-cr-text-muted">{p.counts.bookings}</td>
                  <td className="px-cr-md py-cr-sm">
                    <div className="flex gap-cr-sm">
                      {p.status !== 'active' && (
                        <button
                          onClick={() => patchStatus(p.id, 'active')}
                          disabled={busyId === p.id}
                          className="text-xs font-semibold text-cr-primary hover:underline disabled:opacity-50"
                        >
                          {t('approve')}
                        </button>
                      )}
                      {p.status !== 'suspended' && (
                        <button
                          onClick={() => patchStatus(p.id, 'suspended')}
                          disabled={busyId === p.id}
                          className="text-xs font-semibold text-cr-danger hover:underline disabled:opacity-50"
                        >
                          {t('suspend')}
                        </button>
                      )}
                    </div>
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
