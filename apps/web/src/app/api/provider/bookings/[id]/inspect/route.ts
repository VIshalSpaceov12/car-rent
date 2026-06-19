import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import {
  inspectionSchema,
  returnConditionToDb,
  bookingStatusFromDb,
  bookingStatusToDb,
  returnConditionFromDb,
} from '@car-rental/types';
import { assertTransition, LifecycleError } from '@/server/modules/bookings/lifecycle';
import { bookingToDTO } from '@/server/mappers';
import { publishBookingStatus } from '@/server/realtime/publishBookingStatus';

const BOOKING_INCLUDE = {
  vehicle: { select: { id: true, name: true } },
  pickupBranch: { select: { name: true } },
  dropoffBranch: { select: { name: true } },
} as const;

export async function POST(
  req: Request,
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

  const body = await req.json().catch(() => null);
  const parsed = inspectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: { id, ...tenantScope(user) },
    include: BOOKING_INCLUDE,
  });

  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const currentStatus = bookingStatusFromDb(booking.status);

  if (currentStatus !== 'returned') {
    return NextResponse.json(
      { error: 'invalid_status', message: `Booking must be in 'returned' status to record inspection, got '${currentStatus}'` },
      { status: 422 }
    );
  }

  try {
    assertTransition('returned', 'completed', user.role);
  } catch (err) {
    if (err instanceof LifecycleError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    throw err;
  }

  const { inspection, booking: updatedBooking } = await prisma.$transaction(async (tx) => {
    const insp = await tx.returnInspection.create({
      data: {
        bookingId: id,
        providerId: booking.providerId,
        condition: returnConditionToDb(parsed.data.condition) as 'CLEAN' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE',
        notes: parsed.data.notes ?? null,
      },
    });

    const b = await tx.booking.update({
      where: { id },
      data: { status: bookingStatusToDb('completed') as 'COMPLETED' },
      include: BOOKING_INCLUDE,
    });

    // Award loyalty points on completion (idempotent: only if no entry exists yet)
    const existingEntry = await tx.loyaltyEntry.findFirst({
      where: { bookingId: id, userId: booking.customerId },
    });

    if (!existingEntry) {
      const pointsEarned = Math.floor(Number(booking.totalAmount));
      if (pointsEarned > 0) {
        await tx.loyaltyEntry.create({
          data: {
            userId: booking.customerId,
            delta: pointsEarned,
            reason: `Completed rental #${id}`,
            bookingId: id,
          },
        });

        await tx.loyaltyAccount.upsert({
          where: { userId: booking.customerId },
          update: { points: { increment: pointsEarned } },
          create: { userId: booking.customerId, points: pointsEarned },
        });
      }
    }

    return { inspection: insp, booking: b };
  });

  publishBookingStatus(updatedBooking);

  return NextResponse.json(
    {
      inspection: {
        id: inspection.id,
        bookingId: inspection.bookingId,
        condition: returnConditionFromDb(inspection.condition),
        notes: inspection.notes,
        inspectedAt: inspection.inspectedAt.toISOString(),
      },
      booking: bookingToDTO(updatedBooking),
    },
    { status: 201 }
  );
}
