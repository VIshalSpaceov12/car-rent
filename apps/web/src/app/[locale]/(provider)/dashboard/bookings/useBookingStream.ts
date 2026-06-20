'use client';
import { useEffect, useRef, useState } from 'react';
import type { BookingStatus } from '@car-rental/types';

/**
 * Opens an SSE connection to /api/bookings/stream and returns a Map of
 * bookingId → latest BookingStatus received over the wire.
 *
 * - Reconnects automatically on error (1 s backoff, capped at 30 s).
 * - Closes the EventSource and clears the timer on unmount.
 */
export function useBookingStream(): ReadonlyMap<string, BookingStatus> {
  const [statusMap, setStatusMap] = useState<ReadonlyMap<string, BookingStatus>>(new Map());
  const retryDelay = useRef(1_000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const es = new EventSource('/api/bookings/stream');
      esRef.current = es;

      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data) as {
            bookingId: string;
            status: BookingStatus;
          };
          setStatusMap((prev) => {
            const next = new Map(prev);
            next.set(payload.bookingId, payload.status);
            return next;
          });
          // Reset backoff on successful message
          retryDelay.current = 1_000;
        } catch {
          // Malformed payload — ignore
        }
      };

      es.onopen = () => {
        // Reset backoff delay on successful connection open
        retryDelay.current = 1_000;
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (cancelled) return;
        // Exponential backoff capped at 30 s
        const delay = retryDelay.current;
        retryDelay.current = Math.min(delay * 2, 30_000);
        timerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  return statusMap;
}
