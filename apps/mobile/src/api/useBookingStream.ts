/**
 * useBookingStream — SSE-backed live booking status hook.
 *
 * IMPLEMENTATION CHOICE: react-native-sse (XHR-based, no native modules required).
 * It connects to ${BASE}/api/bookings/stream with an Authorization Bearer header —
 * the same auth pattern used by every other authedFetch call.
 *
 * FALLBACK: If the SSE library becomes unavailable or the environment does not
 * support it, replace the body of useBookingStream with the polling fallback
 * below (tagged POLLING_FALLBACK) and remove the react-native-sse import.
 *
 * Lifecycle:
 *   - Opens the SSE connection when the component mounts / screen gains focus.
 *   - Calls onStatusChange(bookingId, status) for each incoming event.
 *   - Closes and nullifies the EventSource on blur / unmount.
 */

import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import EventSource from 'react-native-sse';
import type { BookingStatus } from '@car-rental/types';
import { getToken } from '@/auth/storage';
import { parseBookingStatusEvent } from './parseBookingStatusEvent';

export type { BookingStatusEventPayload } from './parseBookingStatusEvent';

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:6001';

interface UseBookingStreamOptions {
  onStatusChange: (bookingId: string, status: BookingStatus) => void;
}

/**
 * Attaches an SSE stream while the screen is focused.
 * Requires the screen to be inside a react-navigation navigator.
 */
export function useBookingStream({ onStatusChange }: UseBookingStreamOptions): void {
  useFocusEffect(
    useCallback(() => {
      let es: InstanceType<typeof EventSource> | null = null;
      let cancelled = false;

      void (async () => {
        const token = await getToken();
        if (cancelled) return;

        const url = `${BASE}/api/bookings/stream`;
        es = new EventSource(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        // Guard: if the focus-effect cancelled while we awaited getToken(),
        // close the EventSource immediately and bail out.
        if (cancelled) {
          es.close();
          es = null;
          return;
        }

        es.addEventListener('message', (event) => {
          if (!event.data) return;
          const payload = parseBookingStatusEvent(event.data);
          if (payload) {
            onStatusChange(payload.bookingId, payload.status);
          }
        });

        // Connection errors are non-fatal — the list retains last-known state
        es.addEventListener('error', () => {
          // intentionally silent; SSE will retry automatically
        });
      })();

      return () => {
        cancelled = true;
        es?.close();
        es = null;
      };
    }, [onStatusChange]),
  );
}

/*
 * POLLING_FALLBACK (uncomment and replace useBookingStream body if needed):
 *
 * import { useCallback } from 'react';
 * import { useFocusEffect } from '@react-navigation/native';
 * import type { BookingStatus } from '@car-rental/types';
 * import { listBookings } from './client';
 *
 * const POLL_INTERVAL_MS = 10_000;
 *
 * export function useBookingStream({ onStatusChange }: UseBookingStreamOptions): void {
 *   useFocusEffect(
 *     useCallback(() => {
 *       const tick = async () => {
 *         const bookings = await listBookings();
 *         for (const b of bookings) onStatusChange(b.id, b.status);
 *       };
 *       void tick();
 *       const id = setInterval(() => void tick(), POLL_INTERVAL_MS);
 *       return () => clearInterval(id);
 *     }, [onStatusChange]),
 *   );
 * }
 */
