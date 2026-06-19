import { describe, it, expect, vi } from 'vitest';
import { BookingEventBus } from './bus';
import type { BookingStatusEvent } from './bus';

// Each test creates a fresh instance to keep tests isolated from the singleton
describe('BookingEventBus', () => {
  it('subscribe receives a published event', () => {
    const bus = new BookingEventBus();
    const handler = vi.fn<(evt: BookingStatusEvent) => void>();

    bus.subscribe(handler);

    const evt: BookingStatusEvent = {
      bookingId: 'b1',
      status: 'confirmed',
      providerId: 'p1',
      customerId: 'c1',
    };
    bus.publish(evt);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(evt);
  });

  it('unsubscribe stops delivery', () => {
    const bus = new BookingEventBus();
    const handler = vi.fn<(evt: BookingStatusEvent) => void>();

    const unsubscribe = bus.subscribe(handler);
    unsubscribe();

    bus.publish({
      bookingId: 'b2',
      status: 'cancelled',
      providerId: 'p1',
      customerId: 'c1',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('multiple subscribers each receive the event', () => {
    const bus = new BookingEventBus();
    const h1 = vi.fn<(evt: BookingStatusEvent) => void>();
    const h2 = vi.fn<(evt: BookingStatusEvent) => void>();

    bus.subscribe(h1);
    bus.subscribe(h2);

    const evt: BookingStatusEvent = {
      bookingId: 'b3',
      status: 'vehicle-prepared',
      providerId: 'p1',
      customerId: 'c1',
    };
    bus.publish(evt);

    expect(h1).toHaveBeenCalledWith(evt);
    expect(h2).toHaveBeenCalledWith(evt);
  });

  it('unsubscribing one handler does not affect others', () => {
    const bus = new BookingEventBus();
    const h1 = vi.fn<(evt: BookingStatusEvent) => void>();
    const h2 = vi.fn<(evt: BookingStatusEvent) => void>();

    bus.subscribe(h1);
    const unsub2 = bus.subscribe(h2);
    unsub2();

    bus.publish({
      bookingId: 'b4',
      status: 'returned',
      providerId: 'p1',
      customerId: 'c1',
    });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).not.toHaveBeenCalled();
  });
});
