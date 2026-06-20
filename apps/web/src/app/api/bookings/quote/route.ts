import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import { bookingQuoteRequestSchema } from '@car-rental/types';
import { computeQuote, PricingError } from '@/server/modules/bookings/pricing';
import { z } from 'zod';

const quoteWithDiscountSchema = bookingQuoteRequestSchema.extend({
  discountCode: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = quoteWithDiscountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const { vehicleId, startDate, endDate, plan, discountCode } = parsed.data;

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

    // Apply discount code if provided
    if (discountCode) {
      const discount = await prisma.discountCode.findFirst({
        where: {
          code: discountCode,
          providerId: vehicle.providerId,
          active: true,
        },
      });

      if (!discount || (discount.expiresAt && discount.expiresAt < new Date())) {
        // Invalid / expired / foreign code — return base quote without discount
        return NextResponse.json({ ...quote, discountApplied: false });
      }

      // Apply discount to subtotal (in cents to avoid drift)
      const subtotalCents = Math.round(quote.subtotal * 100);
      let discountCents: number;

      if (discount.kind === 'PERCENT') {
        discountCents = Math.round(subtotalCents * Number(discount.value) / 100);
      } else {
        // FIXED
        discountCents = Math.round(Number(discount.value) * 100);
      }

      // Cap discount to not exceed subtotal
      discountCents = Math.min(discountCents, subtotalCents);
      const discountedSubtotalCents = subtotalCents - discountCents;
      const serviceChargeCents = Math.round(quote.serviceCharge * 100);
      const taxAmountCents = Math.round((discountedSubtotalCents + serviceChargeCents) * (quote.taxRatePct / 100));
      const totalCents = discountedSubtotalCents + serviceChargeCents + taxAmountCents;

      return NextResponse.json({
        ...quote,
        subtotal: discountedSubtotalCents / 100,
        taxAmount: taxAmountCents / 100,
        total: totalCents / 100,
        discountApplied: true,
        discountCode: discount.code,
        discountKind: discount.kind.toLowerCase(),
        discountValue: Number(discount.value),
        discountAmount: discountCents / 100,
      });
    }

    return NextResponse.json(quote);
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    throw err;
  }
}
