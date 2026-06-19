import { describe, it, expect } from 'vitest';
import { computeQuote, PricingError } from './pricing';

const BASE_PARAMS = {
  vehiclePricePerDay: 100,
  planMultipliers: { daily: 1, weekly: 0.9, monthly: 0.8, 'long-term': 0.7 },
  taxRatePct: 10,
  serviceChargePct: 5,
  minRentalDays: 1,
  currency: 'USD',
};

describe('computeQuote', () => {
  it('computes multi-day daily plan correctly', () => {
    const q = computeQuote({
      ...BASE_PARAMS,
      plan: 'daily',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-04'), // 3 days
    });
    expect(q.days).toBe(3);
    expect(q.planMultiplier).toBe(1);
    expect(q.baseRatePerDay).toBe(100);
    // subtotal = 100 * 3 * 1 = 300
    expect(q.subtotal).toBe(300);
    // serviceCharge = round2(300 * 5/100) = 15
    expect(q.serviceCharge).toBe(15);
    // taxAmount = round2((300+15) * 10/100) = round2(31.5) = 31.5
    expect(q.taxAmount).toBe(31.5);
    // total = 300 + 15 + 31.5 = 346.5
    expect(q.total).toBe(346.5);
    expect(q.currency).toBe('USD');
  });

  it('applies weekly multiplier correctly', () => {
    const q = computeQuote({
      ...BASE_PARAMS,
      plan: 'weekly',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-08'), // 7 days
    });
    expect(q.days).toBe(7);
    expect(q.planMultiplier).toBe(0.9);
    // subtotal = 100 * 7 * 0.9 = 630
    expect(q.subtotal).toBe(630);
  });

  it('applies monthly multiplier correctly', () => {
    const q = computeQuote({
      ...BASE_PARAMS,
      plan: 'monthly',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-02-01'), // 31 days
    });
    expect(q.days).toBe(31);
    expect(q.planMultiplier).toBe(0.8);
    // subtotal = 100 * 31 * 0.8 = 2480
    expect(q.subtotal).toBe(2480);
  });

  it('applies long-term multiplier correctly', () => {
    const q = computeQuote({
      ...BASE_PARAMS,
      plan: 'long-term',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-11'), // 10 days
    });
    expect(q.planMultiplier).toBe(0.7);
    // subtotal = 100 * 10 * 0.7 = 700
    expect(q.subtotal).toBe(700);
  });

  it('tax and serviceCharge math is correct with fractional amounts', () => {
    // pricePerDay=33.33, 1 day, serviceCharge 5%, tax 8%
    const q = computeQuote({
      vehiclePricePerDay: 33.33,
      planMultipliers: { daily: 1, weekly: 0.9, monthly: 0.8, 'long-term': 0.7 },
      plan: 'daily',
      taxRatePct: 8,
      serviceChargePct: 5,
      minRentalDays: 1,
      currency: 'USD',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-02'), // 1 day
    });
    expect(q.days).toBe(1);
    // subtotal = 33.33
    expect(q.subtotal).toBe(33.33);
    // serviceCharge = round2(33.33 * 0.05) = round2(1.6665) = 1.67
    expect(q.serviceCharge).toBe(1.67);
    // taxAmount = round2((33.33 + 1.67) * 0.08) = round2(35 * 0.08) = round2(2.8) = 2.8
    expect(q.taxAmount).toBe(2.8);
    // total = 33.33 + 1.67 + 2.8 = 37.8
    expect(q.total).toBe(37.8);
  });

  it('rejects when days < minRentalDays', () => {
    expect(() =>
      computeQuote({
        ...BASE_PARAMS,
        minRentalDays: 3,
        plan: 'daily',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-03'), // 2 days < 3
      })
    ).toThrow(PricingError);
  });

  it('rejects when endDate <= startDate', () => {
    expect(() =>
      computeQuote({
        ...BASE_PARAMS,
        plan: 'daily',
        startDate: new Date('2025-01-05'),
        endDate: new Date('2025-01-05'),
      })
    ).toThrow(PricingError);

    expect(() =>
      computeQuote({
        ...BASE_PARAMS,
        plan: 'daily',
        startDate: new Date('2025-01-05'),
        endDate: new Date('2025-01-04'),
      })
    ).toThrow(PricingError);
  });

  it('uses ceil for partial day', () => {
    // 1.5 days should ceil to 2
    const q = computeQuote({
      ...BASE_PARAMS,
      plan: 'daily',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2025-01-02T12:00:00Z'), // 1.5 days
    });
    expect(q.days).toBe(2);
  });

  it('returns correct seasonalMultiplier (1 by default)', () => {
    const q = computeQuote({
      ...BASE_PARAMS,
      plan: 'daily',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-02'),
    });
    expect(q.seasonalMultiplier).toBe(1);
  });
});
