import type { BookingStatus } from '@car-rental/types';

export interface BookingStatusEventPayload {
  bookingId: string;
  status: BookingStatus;
}

/** Parses a raw SSE `data:` line string into a BookingStatusEventPayload. */
export function parseBookingStatusEvent(raw: string): BookingStatusEventPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'bookingId' in parsed &&
      'status' in parsed &&
      typeof (parsed as Record<string, unknown>).bookingId === 'string' &&
      typeof (parsed as Record<string, unknown>).status === 'string'
    ) {
      const p = parsed as Record<string, string>;
      const bookingId = p['bookingId'];
      const status = p['status'];
      if (!bookingId || !status) return null;
      return { bookingId, status: status as BookingStatus };
    }
    return null;
  } catch {
    return null;
  }
}
