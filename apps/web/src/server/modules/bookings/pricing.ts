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

/** Convert a number to integer cents, rounding half-up. */
function toCents(value: number): number {
  return Math.round(value * 100);
}

/** Convert integer cents back to a 2-decimal-place number. */
function fromCents(cents: number): number {
  return cents / 100;
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

  // All intermediate calculations in integer cents to avoid IEEE-754 drift.
  const baseRateCents = toCents(vehiclePricePerDay);
  const subtotalCents = Math.round(baseRateCents * days * planMultiplier * seasonalMultiplier);
  const serviceChargeCents = Math.round(subtotalCents * serviceChargePct / 100);
  const taxAmountCents = Math.round((subtotalCents + serviceChargeCents) * taxRatePct / 100);
  const totalCents = subtotalCents + serviceChargeCents + taxAmountCents;

  const subtotal = fromCents(subtotalCents);
  const serviceCharge = fromCents(serviceChargeCents);
  const taxAmount = fromCents(taxAmountCents);
  const total = fromCents(totalCents);

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
