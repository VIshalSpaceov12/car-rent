import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { bookingStatusFromDb, bookingStatusToDb } from '@car-rental/types';
import { assertTransition, LifecycleError } from '@/server/modules/bookings/lifecycle';
import { issueOtp } from '@/server/modules/otp/otp';

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
  });

  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const currentStatus = bookingStatusFromDb(booking.status);

  // Auto-prepare if still confirmed
  if (currentStatus === 'confirmed') {
    try {
      assertTransition('confirmed', 'vehicle-prepared', user.role);
    } catch (err) {
      if (err instanceof LifecycleError) {
        return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
      }
      throw err;
    }

    await prisma.booking.update({
      where: { id },
      data: { status: bookingStatusToDb('vehicle-prepared') as 'VEHICLE_PREPARED' },
    });
  } else if (currentStatus !== 'vehicle-prepared') {
    return NextResponse.json(
      { error: 'invalid_status', message: `Booking must be confirmed or vehicle-prepared to issue OTP, got '${currentStatus}'` },
      { status: 422 }
    );
  }

  const code = await issueOtp({
    id: booking.id,
    vehicleId: booking.vehicleId,
    providerId: booking.providerId,
  });

  // code is the one-time plaintext — returned here only, never stored/logged
  return NextResponse.json({ code }, { status: 201 });
}
