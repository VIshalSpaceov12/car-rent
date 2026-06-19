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

  // Use a transaction to atomically create payment + optionally confirm booking
  const [payment, updatedBooking] = await prisma.$transaction(async (tx) => {
    const pay = await tx.payment.create({
      data: {
        providerId: booking.providerId,
        bookingId: booking.id,
        amount: booking.totalAmount,
        currency: booking.currency,
        method: paymentMethodToDb(method) as 'CARD' | 'CASH_ON_DELIVERY',
        status: paymentStatusToDb(paymentStatus) as 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED',
      },
    });

    if (confirmsBooking) {
      // Validate the transition (throws if not 'reserved')
      try {
        confirmAfterPayment(currentStatus);
      } catch (err) {
        if (err instanceof LifecycleError) {
          throw err; // Will be caught outside transaction as 422
        }
        throw err;
      }

      const b = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: bookingStatusToDb('confirmed') as 'CONFIRMED',
        },
        include: BOOKING_INCLUDE,
      });
      return [pay, b] as const;
    }

    const b = await tx.booking.findUnique({
      where: { id: booking.id },
      include: BOOKING_INCLUDE,
    });
    return [pay, b!] as const;
  });

  return NextResponse.json(
    {
      payment: paymentToDTO(payment),
      booking: bookingToDTO(updatedBooking),
    },
    { status: 201 }
  );
}
