import type { BookingQuote, RentalPlan } from '@car-rental/types';

export class PricingError extends Error {
  constructor(
    public readonly code: 'INVALID_DATE_RANGE' | 'BELOW_MIN_RENTAL_DAYS',
    message: string
  ) {
    super(message);
    this.name = 'PricingError';
  }
}

/** Round to exactly 2 decimal places using integer-cent math to avoid float drift. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface ComputeQuoteParams {
  vehiclePricePerDay: number;
  planMultipliers: Record<string, number>;
  plan: RentalPlan;
  taxRatePct: number;
  serviceChargePct: number;
  minRentalDays: number;
  currency: string;
  startDate: Date;
  endDate: Date;
}

export function computeQuote(params: ComputeQuoteParams): BookingQuote {
  const {
    vehiclePricePerDay,
    planMultipliers,
    plan,
    taxRatePct,
    serviceChargePct,
    minRentalDays,
    currency,
    startDate,
    endDate,
  } = params;

  if (endDate <= startDate) {
    throw new PricingError('INVALID_DATE_RANGE', 'endDate must be after startDate');
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);

  if (days < minRentalDays) {
    throw new PricingError(
      'BELOW_MIN_RENTAL_DAYS',
      `Minimum rental is ${minRentalDays} day(s); got ${days}`
    );
  }

  const planMultiplier = planMultipliers[plan] ?? 1;
  const seasonalMultiplier = 1;

  const subtotal = round2(vehiclePricePerDay * days * planMultiplier * seasonalMultiplier);
  const serviceCharge = round2(subtotal * serviceChargePct / 100);
  const taxAmount = round2((subtotal + serviceCharge) * taxRatePct / 100);
  const total = round2(subtotal + serviceCharge + taxAmount);

  return {
    days,
    baseRatePerDay: vehiclePricePerDay,
    planMultiplier,
    seasonalMultiplier,
    subtotal,
    taxRatePct,
    taxAmount,
    serviceCharge,
    total,
    currency,
  };
}
