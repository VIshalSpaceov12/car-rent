'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StatusChip } from '@/ui/StatusChip';
import { useBookingStream } from './useBookingStream';
import type { BookingStatus } from '@car-rental/types';

export interface BookingRow {
  id: string;
  customerName: string;
  vehicleName: string;
  startDate: string;
  endDate: string;
  plan: string;
  currency: string;
  totalAmount: number;
  status: BookingStatus;
}

interface LiveBookingsTableProps {
  rows: BookingRow[];
  locale: string;
}

/**
 * Client wrapper over the server-rendered bookings list.
 * Receives initial rows from the server and layers live status updates from SSE
 * without requiring a full page refresh.
 */
export function LiveBookingsTable({ rows, locale }: LiveBookingsTableProps) {
  const t = useTranslations('bookings');
  const liveStatuses = useBookingStream();

  return (
    <div className="overflow-x-auto rounded-cr-card border border-cr-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cr-surface-alt text-cr-text-muted">
            <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.customer')}</th>
            <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.vehicle')}</th>
            <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.dates')}</th>
            <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.plan')}</th>
            <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.total')}</th>
            <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.status')}</th>
            <th className="px-cr-md py-cr-sm text-start font-semibold">{t('columns.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b, i) => {
            const liveStatus = liveStatuses.get(b.id) ?? b.status;
            return (
              <tr key={b.id} className={i % 2 === 0 ? 'bg-cr-surface' : 'bg-cr-surface-alt'}>
                <td className="px-cr-md py-cr-sm text-cr-text font-medium">{b.customerName}</td>
                <td className="px-cr-md py-cr-sm text-cr-text-muted">{b.vehicleName}</td>
                <td className="px-cr-md py-cr-sm text-cr-text-muted whitespace-nowrap">
                  {new Intl.DateTimeFormat(locale).format(new Date(b.startDate))} {t('dateSeparator')} {new Intl.DateTimeFormat(locale).format(new Date(b.endDate))}
                </td>
                <td className="px-cr-md py-cr-sm text-cr-text-muted">{t(`plan.${b.plan}`)}</td>
                <td className="px-cr-md py-cr-sm text-cr-text font-medium">
                  {new Intl.NumberFormat(locale, { style: 'currency', currency: b.currency }).format(b.totalAmount)}
                </td>
                <td className="px-cr-md py-cr-sm">
                  <StatusChip status={liveStatus} label={t(`status.${liveStatus}`)} />
                </td>
                <td className="px-cr-md py-cr-sm">
                  <Link
                    href={`/${locale}/dashboard/bookings/${b.id}`}
                    className="text-cr-primary text-sm font-semibold hover:underline"
                  >
                    {t('view')}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
