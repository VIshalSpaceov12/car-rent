import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import { bookingQuoteRequestSchema } from '@car-rental/types';
import { computeQuote, PricingError } from '@/server/modules/bookings/pricing';

export async function POST(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bookingQuoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const { vehicleId, startDate, endDate, plan } = parsed.data;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { provider: { include: { businessSettings: true } } },
  });

  if (!vehicle) return NextResponse.json({ error: 'vehicle_not_found' }, { status: 404 });

  const settings = vehicle.provider.businessSettings;
  const planMultipliers = (settings?.planMultipliers ?? { daily: 1, weekly: 0.9, monthly: 0.8, 'long-term': 0.7 }) as Record<string, number>;

  try {
    const quote = computeQuote({
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

    return NextResponse.json(quote);
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    throw err;
  }
}
