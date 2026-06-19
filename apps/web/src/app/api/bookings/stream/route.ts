import { verifySession } from '@/server/auth/dal';
import { bookingBus } from '@/server/realtime/bus';
import type { BookingStatusEvent } from '@/server/realtime/bus';

const HEARTBEAT_INTERVAL_MS = 25_000;

function sseComment(msg = '') {
  return `: ${msg}\n\n`;
}

function sseData(payload: BookingStatusEvent) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function isAllowed(user: NonNullable<Awaited<ReturnType<typeof verifySession>>>, evt: BookingStatusEvent): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return evt.customerId === user.id;
  // provider / staff
  return !!user.providerId && evt.providerId === user.providerId;
}

export async function GET() {
  const user = await verifySession();
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Initial keep-alive comment
      controller.enqueue(new TextEncoder().encode(sseComment('connected')));

      // Subscribe to the event bus
      unsubscribe = bookingBus.subscribe((evt) => {
        if (isAllowed(user, evt)) {
          try {
            controller.enqueue(new TextEncoder().encode(sseData(evt)));
          } catch {
            // Stream may already be closed; ignore enqueue errors
          }
        }
      });

      // Periodic heartbeat to keep the connection alive through proxies
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(sseComment('heartbeat')));
        } catch {
          // Stream closed; clear the interval on the next cancel
          if (heartbeatTimer !== null) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        }
      }, HEARTBEAT_INTERVAL_MS);
    },

    cancel() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
