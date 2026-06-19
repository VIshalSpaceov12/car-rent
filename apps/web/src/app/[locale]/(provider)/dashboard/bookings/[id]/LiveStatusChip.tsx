'use client';
import { useTranslations } from 'next-intl';
import { StatusChip } from '@/ui/StatusChip';
import { useBookingStream } from '../useBookingStream';
import type { BookingStatus } from '@car-rental/types';

interface LiveStatusChipProps {
  bookingId: string;
  initialStatus: BookingStatus;
}

/**
 * Renders the booking status chip and keeps it updated via SSE without a
 * full page refresh.
 */
export function LiveStatusChip({ bookingId, initialStatus }: LiveStatusChipProps) {
  const t = useTranslations('bookings');
  const liveStatuses = useBookingStream();
  const status = liveStatuses.get(bookingId) ?? initialStatus;
  return <StatusChip status={status} label={t(`status.${status}`)} />;
}
