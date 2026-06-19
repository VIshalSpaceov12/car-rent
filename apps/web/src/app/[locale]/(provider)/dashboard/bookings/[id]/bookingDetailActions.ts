'use server';
import { redirect } from 'next/navigation';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { prisma } from '@/server/db';
import { issueOtp } from '@/server/modules/otp/otp';
import { bookingStatusFromDb, bookingStatusToDb, returnConditionToDb, type ReturnCondition } from '@car-rental/types';
import { assertTransition, LifecycleError } from '@/server/modules/bookings/lifecycle';
import { Prisma } from '@prisma/client';

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

/** confirmed → vehicle-prepared */
export async function prepareVehicle(
  locale: string,
  bookingId: string,
): Promise<{ error: string } | null> {
  const user = await guardProvider(locale);

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ...tenantScope(user) },
  });
  if (!booking) return { error: 'not_found' };

  const currentStatus = bookingStatusFromDb(booking.status);
  try {
    assertTransition(currentStatus, 'vehicle-prepared', user.role);
  } catch (err) {
    if (err instanceof LifecycleError) return { error: err.code };
    throw err;
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: bookingStatusToDb(
        'vehicle-prepared',
      ) as Prisma.BookingUpdateInput['status'] & string,
    },
  });

  redirect(`/${locale}/dashboard/bookings/${bookingId}`);
}

/**
 * Issues an OTP.  Returns the one-time plaintext code on success so the
 * provider can read it out — the ONLY place plaintext ever leaves the server.
 */
export async function issueBookingOtp(
  locale: string,
  bookingId: string,
): Promise<{ code: string } | { error: string }> {
  const user = await guardProvider(locale);

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ...tenantScope(user) },
  });
  if (!booking) return { error: 'not_found' };

  const currentStatus = bookingStatusFromDb(booking.status);

  // Auto-prepare if still confirmed (mirrors the API route logic)
  if (currentStatus === 'confirmed') {
    try {
      assertTransition('confirmed', 'vehicle-prepared', user.role);
    } catch (err) {
      if (err instanceof LifecycleError) return { error: err.code };
      throw err;
    }
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: bookingStatusToDb(
          'vehicle-prepared',
        ) as Prisma.BookingUpdateInput['status'] & string,
      },
    });
  } else if (currentStatus !== 'vehicle-prepared') {
    return { error: 'invalid_status' };
  }

  const code = await issueOtp({
    id: booking.id,
    vehicleId: booking.vehicleId,
    providerId: booking.providerId,
  });

  // code is returned once here — never stored/logged.
  return { code };
}

/** Records return inspection and transitions returned → completed. */
export async function recordInspection(
  locale: string,
  bookingId: string,
  condition: ReturnCondition,
  notes: string,
): Promise<{ error: string } | null> {
  const user = await guardProvider(locale);

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ...tenantScope(user) },
  });
  if (!booking) return { error: 'not_found' };

  const currentStatus = bookingStatusFromDb(booking.status);
  if (currentStatus !== 'returned') return { error: 'invalid_status' };

  try {
    assertTransition('returned', 'completed', user.role);
  } catch (err) {
    if (err instanceof LifecycleError) return { error: err.code };
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.returnInspection.create({
      data: {
        bookingId,
        providerId: booking.providerId,
        condition: returnConditionToDb(
          condition,
        ) as 'CLEAN' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE',
        notes: notes.trim() || null,
      },
    });
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: bookingStatusToDb(
          'completed',
        ) as Prisma.BookingUpdateInput['status'] & string,
      },
    });
  });

  redirect(`/${locale}/dashboard/bookings/${bookingId}`);
}
