import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import {
  paymentStatusToDb,
  bookingStatusFromDb,
  bookingStatusToDb,
} from '@car-rental/types';
import { paymentToDTO } from '@/server/mappers';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          vehicle: { select: { id: true, name: true } },
          pickupBranch: { select: { name: true } },
          dropoffBranch: { select: { name: true } },
        },
      },
    },
  });

  if (!payment) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Tenant scope: non-admin must own the provider
  const scope = tenantScope(user);
  if (scope.providerId && payment.providerId !== scope.providerId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Only a 'paid' payment can be refunded
  if (payment.status !== 'PAID') {
    return NextResponse.json(
      { error: 'not_refundable', message: `Payment status is '${payment.status}', expected 'PAID'` },
      { status: 422 }
    );
  }

  const bookingCurrentStatus = bookingStatusFromDb(payment.booking.status);

  // Determine if booking is still pre-pickup (can be cancelled on refund)
  const prePickupStatuses = new Set(['reserved', 'confirmed', 'vehicle-prepared']);
  const shouldCancelBooking = prePickupStatuses.has(bookingCurrentStatus);

  const updatedPayment = await prisma.$transaction(async (tx) => {
    const pay = await tx.payment.update({
      where: { id },
      data: { status: paymentStatusToDb('refunded') as 'REFUNDED' },
    });

    if (shouldCancelBooking) {
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: bookingStatusToDb('cancelled') as 'CANCELLED' },
      });
    }

    return pay;
  });

  return NextResponse.json(paymentToDTO(updatedPayment));
}
