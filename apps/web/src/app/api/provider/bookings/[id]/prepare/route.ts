import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { bookingStatusFromDb, bookingStatusToDb } from '@car-rental/types';
import { assertTransition, LifecycleError } from '@/server/modules/bookings/lifecycle';
import { bookingToDTO } from '@/server/mappers';
import { publishBookingStatus } from '@/server/realtime/publishBookingStatus';

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

  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const { id } = await params;

  const booking = await prisma.booking.findFirst({
    where: { id, ...tenantScope(user) },
    include: BOOKING_INCLUDE,
  });

  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const currentStatus = bookingStatusFromDb(booking.status);

  try {
    assertTransition(currentStatus, 'vehicle-prepared', user.role);
  } catch (err) {
    if (err instanceof LifecycleError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    throw err;
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: bookingStatusToDb('vehicle-prepared') as 'VEHICLE_PREPARED' },
    include: BOOKING_INCLUDE,
  });

  publishBookingStatus(updated);

  return NextResponse.json(bookingToDTO(updated), { status: 201 });
}
