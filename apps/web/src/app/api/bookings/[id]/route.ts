import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import { bookingToDTO } from '@/server/mappers';

const BOOKING_INCLUDE = {
  vehicle: { select: { id: true, name: true } },
  pickupBranch: { select: { name: true } },
  dropoffBranch: { select: { name: true } },
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;

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
    // provider or staff: must be same tenant
    if (!user.providerId || booking.providerId !== user.providerId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  return NextResponse.json(bookingToDTO(booking));
}
