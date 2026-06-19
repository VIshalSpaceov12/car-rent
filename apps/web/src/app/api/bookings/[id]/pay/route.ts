import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import {
  payInitiateSchema,
  paymentMethodToDb,
  paymentStatusToDb,
  bookingStatusToDb,
  bookingStatusFromDb,
} from '@car-rental/types';
import { resolveOutcome } from '@/server/modules/payments/payment';
import { confirmAfterPayment, LifecycleError } from '@/server/modules/bookings/lifecycle';
import { bookingToDTO, paymentToDTO } from '@/server/mappers';
import { publishBookingStatus } from '@/server/realtime/publishBookingStatus';

const BOOKING_INCLUDE = {
  vehicle: { select: { id: true, name: true } },
  pickupBranch: { select: { name: true } },
  dropoffBranch: { select: { name: true } },
  payment: true,
} as const;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Only customers can pay
  if (user.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = payInitiateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { method, cardOutcome } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: BOOKING_INCLUDE,
  });

  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Ownership: customer must own this booking
  if (booking.customerId !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Idempotency: booking already confirmed or has a paid payment → 409
  const currentStatus = bookingStatusFromDb(booking.status);
  if (currentStatus === 'confirmed' || currentStatus === 'completed') {
    return NextResponse.json({ error: 'already_confirmed' }, { status: 409 });
  }
  if (booking.payment && booking.payment.status === 'PAID') {
    return NextResponse.json({ error: 'already_paid' }, { status: 409 });
  }

  // Booking must be in 'reserved' state to accept payment
  if (currentStatus !== 'reserved') {
    return NextResponse.json(
      { error: 'booking_not_payable', message: `Booking status is '${currentStatus}', expected 'reserved'` },
      { status: 422 }
    );
  }

  const { paymentStatus, confirmsBooking } = resolveOutcome(method, cardOutcome);

  // Use a transaction to atomically upsert payment + optionally confirm booking.
  // Payment.bookingId is @unique (1:1), so after a FAILED attempt a Payment row
  // already exists. We upsert to avoid a P2002 unique-constraint crash on retry.
  const txResult = await (async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const payData = {
          providerId: booking.providerId,
          bookingId: booking.id,
          amount: booking.totalAmount,
          currency: booking.currency,
          method: paymentMethodToDb(method) as 'CARD' | 'CASH_ON_DELIVERY',
          status: paymentStatusToDb(paymentStatus) as 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED',
        };

        const pay = await tx.payment.upsert({
          where: { bookingId: booking.id },
          create: payData,
          update: {
            method: payData.method,
            status: payData.status,
          },
        });

        if (confirmsBooking) {
          // Validate the transition (throws LifecycleError if not 'reserved')
          confirmAfterPayment(currentStatus);

          const b = await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: bookingStatusToDb('confirmed') as 'CONFIRMED',
            },
            include: BOOKING_INCLUDE,
          });
          return { pay, b };
        }

        const b = await tx.booking.findUnique({
          where: { id: booking.id },
          include: BOOKING_INCLUDE,
        });
        return { pay, b: b! };
      });
    } catch (err) {
      if (err instanceof LifecycleError) {
        return { lifecycleError: err.message };
      }
      throw err;
    }
  })();

  if ('lifecycleError' in txResult) {
    return NextResponse.json(
      { error: 'lifecycle_error', message: txResult.lifecycleError },
      { status: 422 }
    );
  }

  // Only publish if the booking status actually changed (i.e. confirmsBooking was true)
  if (confirmsBooking) {
    publishBookingStatus(txResult.b);
  }

  return NextResponse.json(
    {
      payment: paymentToDTO(txResult.pay),
      booking: bookingToDTO(txResult.b),
    },
    { status: 201 }
  );
}
