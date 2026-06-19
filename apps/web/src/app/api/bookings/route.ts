import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import {
  bookingCreateRequestSchema,
  bookingStatusToDb,
} from '@car-rental/types';
import { computeQuote, PricingError } from '@/server/modules/bookings/pricing';
import { bookingToDTO } from '@/server/mappers';

const BOOKING_INCLUDE = {
  vehicle: { select: { id: true, name: true } },
  pickupBranch: { select: { name: true } },
  dropoffBranch: { select: { name: true } },
} as const;

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let where: Record<string, unknown> = {};

  if (user.role === 'customer') {
    where = { customerId: user.id };
  } else {
    // provider, staff, admin
    try {
      requireRole(user, 'provider', 'staff', 'admin');
    } catch {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (user.role !== 'admin' && !user.providerId) {
      return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
    }
    where = tenantScope(user);
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: BOOKING_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(bookings.map(bookingToDTO));
}

export async function POST(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Only customers can create bookings
  try {
    requireRole(user, 'customer');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bookingCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const { vehicleId, startDate, endDate, plan, pickupBranchId, dropoffBranchId } = parsed.data;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { provider: { include: { businessSettings: true } } },
  });

  if (!vehicle) return NextResponse.json({ error: 'vehicle_not_found' }, { status: 404 });

  const settings = vehicle.provider.businessSettings;
  const planMultipliers = (settings?.planMultipliers ?? { daily: 1, weekly: 0.9, monthly: 0.8, 'long-term': 0.7 }) as Record<string, number>;

  let quote;
  try {
    quote = computeQuote({
      vehiclePricePerDay: Number(vehicle.pricePerDay),
      planMultipliers,
      plan,
      taxRatePct: Number(settings?.taxRatePct ?? 0),
      serviceChargePct: Number(settings?.serviceChargePct ?? 0),
      minRentalDays: settings?.minRentalDays ?? 1,
      currency: settings?.currency ?? 'USD',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    throw err;
  }

  const booking = await prisma.booking.create({
    data: {
      providerId: vehicle.providerId,
      customerId: user.id,
      vehicleId,
      pickupBranchId: pickupBranchId ?? null,
      dropoffBranchId: dropoffBranchId ?? null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      plan: plan.toUpperCase().replace(/-/g, '_') as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'LONG_TERM',
      status: bookingStatusToDb('reserved') as 'RESERVED',
      baseAmount: quote.subtotal,
      taxAmount: quote.taxAmount,
      serviceCharge: quote.serviceCharge,
      totalAmount: quote.total,
      currency: quote.currency,
    },
    include: BOOKING_INCLUDE,
  });

  return NextResponse.json(bookingToDTO(booking), { status: 201 });
}
