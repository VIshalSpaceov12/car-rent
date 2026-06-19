import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import { contractSignSchema, bookingStatusFromDb } from '@car-rental/types';
import { signContract, ContractError } from '@/server/modules/otp/contract';
import { bookingToDTO } from '@/server/mappers';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (user.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = contractSignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      vehicle: { select: { id: true, name: true } },
      pickupBranch: { select: { name: true } },
      dropoffBranch: { select: { name: true } },
    },
  });

  if (!booking || booking.customerId !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const currentStatus = bookingStatusFromDb(booking.status);

  try {
    const { contract, booking: updatedBooking } = await signContract(id, {
      signatureName: parsed.data.signatureName,
      providerId: booking.providerId,
      vehicleId: booking.vehicleId,
      currentStatus,
    });

    return NextResponse.json(
      {
        contract: {
          id: contract.id,
          bookingId: contract.bookingId,
          signedAt: contract.signedAt?.toISOString() ?? null,
          signatureName: contract.signatureName,
          termsVersion: contract.termsVersion,
        },
        booking: bookingToDTO(updatedBooking),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ContractError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    throw err;
  }
}
