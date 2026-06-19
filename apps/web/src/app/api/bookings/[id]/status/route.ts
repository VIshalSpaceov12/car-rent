import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import {
  BOOKING_STATUSES,
  bookingStatusFromDb,
  bookingStatusToDb,
} from '@car-rental/types';
import { assertTransition, LifecycleError } from '@/server/modules/bookings/lifecycle';
import { bookingToDTO } from '@/server/mappers';

const BOOKING_INCLUDE = {
  vehicle: { select: { id: true, name: true } },
  pickupBranch: { select: { name: true } },
  dropoffBranch: { select: { name: true } },
} as const;

const statusPatchSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = statusPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const nextStatus = parsed.data.status;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: BOOKING_INCLUDE,
  });

  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Ownership / tenant check
  if (user.role === 'customer') {
    if (booking.customerId !== user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  } else if (user.role !== 'admin') {
    if (!user.providerId || booking.providerId !== user.providerId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const currentStatus = bookingStatusFromDb(booking.status);

  try {
    assertTransition(currentStatus, nextStatus, user.role);
  } catch (err) {
    if (err instanceof LifecycleError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    throw err;
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: bookingStatusToDb(nextStatus) as typeof booking.status },
    include: BOOKING_INCLUDE,
  });

  return NextResponse.json(bookingToDTO(updated));
}
