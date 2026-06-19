import {
  type PaymentMethod,
  type PaymentStatus,
} from '@car-rental/types';

export interface ResolvedOutcome {
  paymentStatus: PaymentStatus;
  confirmsBooking: boolean;
}

/**
 * Pure function — no I/O, no side effects.
 * Maps (method, cardOutcome?) to a payment outcome:
 *   card + success (default) → paid, confirms booking
 *   card + fail              → failed, does NOT confirm
 *   cash-on-delivery         → pending, confirms (collect later)
 */
export function resolveOutcome(
  method: PaymentMethod,
  cardOutcome: 'success' | 'fail' = 'success'
): ResolvedOutcome {
  if (method === 'cash-on-delivery') {
    return { paymentStatus: 'pending', confirmsBooking: true };
  }

  // method === 'card'
  if (cardOutcome === 'fail') {
    return { paymentStatus: 'failed', confirmsBooking: false };
  }

  return { paymentStatus: 'paid', confirmsBooking: true };
}
