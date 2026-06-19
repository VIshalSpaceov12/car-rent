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

  // Fetch payment (with booking) for tenant-scope check and booking-cancel decision.
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

  // Determine if booking is still pre-pickup (can be cancelled on refund)
  const bookingCurrentStatus = bookingStatusFromDb(payment.booking.status);
  const prePickupStatuses = new Set(['reserved', 'confirmed', 'vehicle-prepared']);
  const shouldCancelBooking = prePickupStatuses.has(bookingCurrentStatus);

  // Atomic PAID→REFUNDED: the where-clause scopes to both paymentId+status+tenant so two
  // concurrent requests cannot both flip the same payment (second gets count=0 → 422).
  const updatedPayment = await prisma.$transaction(async (tx) => {
    const res = await tx.payment.updateMany({
      where: {
        id,
        status: 'PAID',
        ...(scope.providerId ? { providerId: scope.providerId } : {}),
      },
      data: { status: paymentStatusToDb('refunded') as 'REFUNDED' },
    });

    if (res.count !== 1) return null;

    if (shouldCancelBooking) {
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: bookingStatusToDb('cancelled') as 'CANCELLED' },
      });
    }

    return tx.payment.findUnique({ where: { id } });
  });

  if (!updatedPayment) {
    return NextResponse.json(
      { error: 'not_refundable', message: `Payment status is '${payment.status}', expected 'PAID'` },
      { status: 422 }
    );
  }

  return NextResponse.json(paymentToDTO(updatedPayment));
}
