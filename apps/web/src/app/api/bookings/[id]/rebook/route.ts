import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import { bookingStatusToDb } from '@car-rental/types';
import { computeQuote, PricingError } from '@/server/modules/bookings/pricing';
import { bookingToDTO } from '@/server/mappers';
import { publishBookingStatus } from '@/server/realtime/publishBookingStatus';
import { z } from 'zod';

const BOOKING_INCLUDE = {
  vehicle: { select: { id: true, name: true } },
  pickupBranch: { select: { name: true } },
  dropoffBranch: { select: { name: true } },
} as const;

const rebookSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO date YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO date YYYY-MM-DD'),
}).optional();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'customer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;

  const sourceBooking = await prisma.booking.findUnique({
    where: { id },
    include: {
      vehicle: { include: { provider: { include: { businessSettings: true } } } },
    },
  });

  if (!sourceBooking || sourceBooking.customerId !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Parse optional new dates from body
  const rawBody = await req.json().catch(() => ({}));
  const parsedDates = rebookSchema.safeParse(rawBody);
  if (!parsedDates.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsedDates.error.issues }, { status: 400 });
  }

  let startDate: Date;
  let endDate: Date;

  if (parsedDates.data) {
    startDate = new Date(parsedDates.data.startDate);
    endDate = new Date(parsedDates.data.endDate);
  } else {
    // Default: same duration starting today
    const originalDuration = sourceBooking.endDate.getTime() - sourceBooking.startDate.getTime();
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate.getTime() + originalDuration);
  }

  const vehicle = sourceBooking.vehicle;
  if (vehicle.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'vehicle_not_available' }, { status: 422 });
  }

  const settings = vehicle.provider.businessSettings;
  const planMultipliers = (settings?.planMultipliers ?? { daily: 1, weekly: 0.9, monthly: 0.8, 'long-term': 0.7 }) as Record<string, number>;
  const sourcePlan = sourceBooking.plan.toLowerCase().replace(/_/g, '-') as 'daily' | 'weekly' | 'monthly' | 'long-term';

  let quote;
  try {
    quote = computeQuote({
      vehiclePricePerDay: Number(vehicle.pricePerDay),
      planMultipliers,
      plan: sourcePlan,
      taxRatePct: Number(settings?.taxRatePct ?? 0),
      serviceChargePct: Number(settings?.serviceChargePct ?? 0),
      minRentalDays: settings?.minRentalDays ?? 1,
      currency: settings?.currency ?? 'USD',
      startDate,
      endDate,
    });
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    throw err;
  }

  const booking = await prisma.booking.create({
    data: {
      providerId: sourceBooking.providerId,
      customerId: user.id,
      vehicleId: sourceBooking.vehicleId,
      pickupBranchId: sourceBooking.pickupBranchId,
      dropoffBranchId: sourceBooking.dropoffBranchId,
      startDate,
      endDate,
      plan: sourceBooking.plan,
      status: bookingStatusToDb('reserved') as 'RESERVED',
      baseAmount: quote.subtotal,
      taxAmount: quote.taxAmount,
      serviceCharge: quote.serviceCharge,
      totalAmount: quote.total,
      currency: quote.currency,
    },
    include: BOOKING_INCLUDE,
  });

  publishBookingStatus(booking);

  return NextResponse.json(bookingToDTO(booking), { status: 201 });
}
