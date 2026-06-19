import 'server-only';
import { prisma } from '@/server/db';
import { assertTransition } from '@/server/modules/bookings/lifecycle';
import { bookingStatusToDb } from '@car-rental/types';
import type { BookingStatus } from '@car-rental/types';

const TERMS_VERSION = '1.0';

export class ContractError extends Error {
  constructor(
    public readonly code: 'otp_not_consumed' | 'already_signed' | 'wrong_status',
    message: string
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

const BOOKING_INCLUDE = {
  vehicle: { select: { id: true, name: true } },
  pickupBranch: { select: { name: true } },
  dropoffBranch: { select: { name: true } },
} as const;

/**
 * Signs the contract for a booking and transitions it to picked-up.
 * Requires:
 *   1. The booking's OTP has been consumed (verified by customer).
 *   2. The booking is currently in `vehicle-prepared` status.
 *
 * Both the Contract upsert and the Booking status update happen in a
 * single Prisma transaction so they are atomic.
 */
export async function signContract(
  bookingId: string,
  input: {
    signatureName: string;
    providerId: string;
    vehicleId: string;
    currentStatus: BookingStatus;
  }
) {
  // Guard 1: Booking must be in vehicle-prepared
  if (input.currentStatus !== 'vehicle-prepared') {
    throw new ContractError(
      'wrong_status',
      `Contract signing requires booking in 'vehicle-prepared', got '${input.currentStatus}'`
    );
  }

  // Guard 2: OTP must be consumed
  const otp = await prisma.otp.findUnique({ where: { bookingId } });
  if (!otp || otp.consumedAt === null) {
    throw new ContractError(
      'otp_not_consumed',
      'OTP must be verified before signing the contract'
    );
  }

  // Assert the transition is legally allowed (system acts as provider role)
  assertTransition('vehicle-prepared', 'picked-up', 'provider');

  const signedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.upsert({
      where: { bookingId },
      create: {
        bookingId,
        providerId: input.providerId,
        signatureName: input.signatureName,
        signedAt,
        termsVersion: TERMS_VERSION,
      },
      update: {
        signatureName: input.signatureName,
        signedAt,
      },
    });

    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: bookingStatusToDb('picked-up') as 'PICKED_UP',
      },
      include: BOOKING_INCLUDE,
    });

    return { contract, booking };
  });
}
