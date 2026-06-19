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
    redirect(user.role === 'admin' ? `/${locale}/admin` : `/${locale}/login`);
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

  if (payment.status !== 'PAID') {
    return { error: 'not_refundable' };
  }

  const bookingCurrentStatus = bookingStatusFromDb(payment.booking.status);
  const prePickupStatuses = new Set(['reserved', 'confirmed', 'vehicle-prepared']);
  const shouldCancelBooking = prePickupStatuses.has(bookingCurrentStatus);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: paymentStatusToDb('refunded') as 'REFUNDED' },
    });

    if (shouldCancelBooking) {
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: bookingStatusToDb('cancelled') as 'CANCELLED' },
      });
    }
  });

  redirect(`/${locale}/dashboard/payments`);
}
