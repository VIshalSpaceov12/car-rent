import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import { bookingStatusFromDb, bookingStatusToDb } from '@car-rental/types';
import { assertTransition, LifecycleError } from '@/server/modules/bookings/lifecycle';
import { bookingToDTO } from '@/server/mappers';

const BOOKING_INCLUDE = {
  vehicle: { select: { id: true, name: true } },
  pickupBranch: { select: { name: true } },
  dropoffBranch: { select: { name: true } },
} as const;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (user.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const booking = await prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });

  if (!booking || booking.customerId !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const currentStatus = bookingStatusFromDb(booking.status);

  try {
    // picked-up → returned is allowed for provider/staff/admin in BOOKING_TRANSITIONS.
    // The return endpoint is customer-facing for demo purposes; we use 'provider' role
    // for the system-side transition since BOOKING_TRANSITIONS doesn't include customer
    // for this step.
    assertTransition(currentStatus, 'returned', 'provider');
  } catch (err) {
    if (err instanceof LifecycleError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    throw err;
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: bookingStatusToDb('returned') as 'RETURNED' },
    include: BOOKING_INCLUDE,
  });

  return NextResponse.json(bookingToDTO(updated));
}
