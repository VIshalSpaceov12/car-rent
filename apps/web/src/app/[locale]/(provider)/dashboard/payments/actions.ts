'use server';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import {
  paymentStatusToDb,
  bookingStatusFromDb,
  bookingStatusToDb,
} from '@car-rental/types';

async function guardProvider(locale: string) {
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    redirect(`/${locale}/login`);
  }
  if (user.role !== 'admin' && !user.providerId) redirect(`/${locale}/login`);
  return user;
}

/** Refund a payment. Returns { error } on failure, or redirects on success. */
export async function refundPayment(
  locale: string,
  paymentId: string,
): Promise<{ error: string } | null> {
  const user = await guardProvider(locale);

  // Fetch payment (with booking) for tenant-scope check and booking-cancel decision.
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });

  if (!payment) return { error: 'not_found' };

  // Tenant scope check
  const scope = tenantScope(user);
  if (scope.providerId && payment.providerId !== scope.providerId) {
    return { error: 'forbidden' };
  }

  const bookingCurrentStatus = bookingStatusFromDb(payment.booking.status);
  const prePickupStatuses = new Set(['reserved', 'confirmed', 'vehicle-prepared']);
  const shouldCancelBooking = prePickupStatuses.has(bookingCurrentStatus);

  // Atomic PAID→REFUNDED: the where-clause scopes to paymentId+status+tenant so two
  // concurrent requests cannot both flip the same payment (second gets count=0 → not_refundable).
  const refunded = await prisma.$transaction(async (tx) => {
    const res = await tx.payment.updateMany({
      where: {
        id: paymentId,
        status: 'PAID',
        ...(scope.providerId ? { providerId: scope.providerId } : {}),
      },
      data: { status: paymentStatusToDb('refunded') as 'REFUNDED' },
    });

    if (res.count !== 1) return false;

    if (shouldCancelBooking) {
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: bookingStatusToDb('cancelled') as 'CANCELLED' },
      });
    }

    return true;
  });

  if (!refunded) return { error: 'not_refundable' };

  redirect(`/${locale}/dashboard/payments`);
}
