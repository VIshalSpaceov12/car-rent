import { EventEmitter } from 'events';
import type { BookingStatus } from '@car-rental/types';

export interface BookingStatusEvent {
  bookingId: string;
  status: BookingStatus;
  providerId: string;
  customerId: string;
}

type Handler = (evt: BookingStatusEvent) => void;

const EVENT_NAME = 'booking-status';

export class BookingEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Prevent Node warning when many SSE clients subscribe simultaneously
    this.emitter.setMaxListeners(200);
  }

  publish(evt: BookingStatusEvent): void {
    this.emitter.emit(EVENT_NAME, evt);
  }

  subscribe(handler: Handler): () => void {
    this.emitter.on(EVENT_NAME, handler);
    return () => {
      this.emitter.off(EVENT_NAME, handler);
    };
  }
}

// globalThis singleton — mirrors src/server/db.ts to survive dev HMR
const g = globalThis as unknown as { _bookingEventBus?: BookingEventBus };
export const bookingBus = g._bookingEventBus ?? new BookingEventBus();
if (process.env.NODE_ENV !== 'production') g._bookingEventBus = bookingBus;
