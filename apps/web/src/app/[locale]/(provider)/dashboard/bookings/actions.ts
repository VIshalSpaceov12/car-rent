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
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: dbStatus },
  });

  redirect(`/${locale}/dashboard/bookings/${bookingId}`);
}
