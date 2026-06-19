'use server';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { Prisma } from '@prisma/client';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import {
  bookingStatusToDb,
  bookingStatusFromDb,
  type BookingStatus,
} from '@car-rental/types';
import { assertTransition, LifecycleError } from '@/server/modules/bookings/lifecycle';
import { publishBookingStatus } from '@/server/realtime/publishBookingStatus';

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

/** Transition a booking status. Returns { error } or redirects on success. */
export async function transitionBooking(
  locale: string,
  bookingId: string,
  next: BookingStatus,
): Promise<{ error: string } | null> {
  const user = await guardProvider(locale);

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ...tenantScope(user) },
  });

  if (!booking) return { error: 'not_found' };

  // Block vehicle-prepared → picked-up here; this transition REQUIRES a verified OTP
  // + signed contract and must go through the customer keyless flow
  // (POST /api/bookings/[id]/otp/verify → POST /api/bookings/[id]/contract/sign).
  if (next === 'picked-up') {
    return { error: 'otp_required' };
  }

  const currentStatus = bookingStatusFromDb(booking.status);

  try {
    assertTransition(currentStatus, next, user.role);
  } catch (err) {
    if (err instanceof LifecycleError) {
      return { error: err.code };
    }
    throw err;
  }

  const dbStatus = bookingStatusToDb(next) as Prisma.BookingUpdateInput['status'] & string;
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: dbStatus },
  });

  publishBookingStatus(updated);

  redirect(`/${locale}/dashboard/bookings/${bookingId}`);
}
