import 'server-only';
import { bookingStatusFromDb } from '@car-rental/types';
import { bookingBus } from './bus';

type MinimalBooking = {
  id: string;
  status: string;
  providerId: string;
  customerId: string;
};

/**
 * Call this after any successful booking-status mutation.
 * Maps the DB-format status to wire format and emits to the in-memory bus.
 */
export function publishBookingStatus(booking: MinimalBooking): void {
  bookingBus.publish({
    bookingId: booking.id,
    status: bookingStatusFromDb(booking.status),
    providerId: booking.providerId,
    customerId: booking.customerId,
  });
}
