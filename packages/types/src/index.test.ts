import { describe, it, expect } from 'vitest';
import {
  USER_ROLES, BOOKING_STATUSES, loginRequestSchema, roleToDb, roleFromDb,
  TRANSMISSIONS, FUEL_TYPES, VEHICLE_STATUSES,
  transmissionToDb, transmissionFromDb,
  fuelTypeToDb, fuelTypeFromDb,
  vehicleStatusToDb, vehicleStatusFromDb,
  vehicleCreateSchema, categoryCreateSchema,
  BOOKING_TRANSITIONS, bookingQuoteRequestSchema,
  payInitiateSchema,
  PAYMENT_METHODS, PAYMENT_STATUSES,
  paymentMethodToDb, paymentMethodFromDb,
  paymentStatusToDb, paymentStatusFromDb,
  RETURN_CONDITIONS, returnConditionToDb, returnConditionFromDb,
  otpVerifySchema, contractSignSchema, inspectionSchema,
} from './index';

describe('@car-rental/types', () => {
  it('exposes the four roles', () => {
    expect(USER_ROLES).toEqual(['customer', 'provider', 'staff', 'admin']);
  });
  it('exposes the full booking lifecycle in order', () => {
    expect(BOOKING_STATUSES).toEqual([
      'reserved', 'confirmed', 'vehicle-prepared', 'picked-up',
      'returned', 'completed', 'rejected', 'cancelled',
    ]);
  });
  it('maps wire role ⇄ db role', () => {
    expect(roleToDb('vehicle-prepared' as never)).toBeUndefined(); // not a role
    expect(roleToDb('provider')).toBe('PROVIDER');
    expect(roleFromDb('PROVIDER')).toBe('provider');
  });
  it('validates a login request', () => {
    expect(loginRequestSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginRequestSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });

  it('exposes Transmission enum values', () => {
    expect(TRANSMISSIONS).toEqual(['automatic', 'manual']);
  });
  it('exposes FuelType enum values', () => {
    expect(FUEL_TYPES).toEqual(['petrol', 'diesel', 'electric', 'hybrid']);
  });
  it('exposes VehicleStatus enum values', () => {
    expect(VEHICLE_STATUSES).toEqual(['active', 'maintenance', 'retired']);
  });
  it('maps Transmission wire ⇄ db', () => {
    expect(transmissionToDb('automatic')).toBe('AUTOMATIC');
    expect(transmissionFromDb('MANUAL')).toBe('manual');
  });
  it('maps FuelType wire ⇄ db', () => {
    expect(fuelTypeToDb('electric')).toBe('ELECTRIC');
    expect(fuelTypeFromDb('PETROL')).toBe('petrol');
  });
  it('maps VehicleStatus wire ⇄ db', () => {
    expect(vehicleStatusToDb('maintenance')).toBe('MAINTENANCE');
    expect(vehicleStatusFromDb('RETIRED')).toBe('retired');
  });
  it('parses a valid vehicleCreateSchema', () => {
    const result = vehicleCreateSchema.safeParse({
      categoryId: 'cat1',
      name: 'Toyota Corolla',
      make: 'Toyota',
      model: 'Corolla',
      year: 2022,
      transmission: 'automatic',
      fuelType: 'petrol',
      pricePerDay: 45.99,
      seats: 5,
    });
    expect(result.success).toBe(true);
  });
  it('rejects vehicleCreateSchema with invalid fuelType', () => {
    const result = vehicleCreateSchema.safeParse({
      categoryId: 'cat1',
      name: 'Mystery Car',
      transmission: 'automatic',
      fuelType: 'nuclear',
      pricePerDay: 100,
    });
    expect(result.success).toBe(false);
  });
  it('parses a valid categoryCreateSchema', () => {
    const result = categoryCreateSchema.safeParse({ name: 'Economy', slug: 'economy' });
    expect(result.success).toBe(true);
  });
  it('rejects categoryCreateSchema with invalid slug', () => {
    const result = categoryCreateSchema.safeParse({ name: 'Economy', slug: 'Economy Cars!' });
    expect(result.success).toBe(false);
  });

  // ---- Booking transition map sanity assertions ----------------------------
  it('BOOKING_TRANSITIONS: terminal states have no transitions', () => {
    expect(BOOKING_TRANSITIONS.completed).toEqual([]);
    expect(BOOKING_TRANSITIONS.rejected).toEqual([]);
    expect(BOOKING_TRANSITIONS.cancelled).toEqual([]);
  });

  it('BOOKING_TRANSITIONS: reserved can move to confirmed/rejected/cancelled', () => {
    const nexts = BOOKING_TRANSITIONS.reserved.map(t => t.next);
    expect(nexts).toContain('confirmed');
    expect(nexts).toContain('rejected');
    expect(nexts).toContain('cancelled');
  });

  it('BOOKING_TRANSITIONS: only provider/staff can confirm a booking', () => {
    const confirm = BOOKING_TRANSITIONS.reserved.find(t => t.next === 'confirmed');
    expect(confirm).toBeDefined();
    expect(confirm!.allowedRoles).toContain('provider');
    expect(confirm!.allowedRoles).not.toContain('customer');
  });

  it('BOOKING_TRANSITIONS: every defined next-status is a valid BookingStatus', () => {
    for (const transitions of Object.values(BOOKING_TRANSITIONS)) {
      for (const { next } of transitions) {
        expect(BOOKING_STATUSES).toContain(next);
      }
    }
  });

  // ---- BookingQuoteRequest schema ------------------------------------------
  it('bookingQuoteRequestSchema: parses a valid request', () => {
    const result = bookingQuoteRequestSchema.safeParse({
      vehicleId: 'v1',
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      plan: 'weekly',
      pickupBranchId: 'b1',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.plan).toBe('weekly');
  });

  it('bookingQuoteRequestSchema: rejects invalid date format', () => {
    const result = bookingQuoteRequestSchema.safeParse({
      vehicleId: 'v1',
      startDate: '01-07-2026',
      endDate: '2026-07-07',
      plan: 'daily',
    });
    expect(result.success).toBe(false);
  });

  it('bookingQuoteRequestSchema: rejects invalid plan', () => {
    const result = bookingQuoteRequestSchema.safeParse({
      vehicleId: 'v1',
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      plan: 'hourly',
    });
    expect(result.success).toBe(false);
  });

  // ---- Payment enums + schema ----------------------------------------------
  it('exposes PAYMENT_METHODS', () => {
    expect(PAYMENT_METHODS).toEqual(['card', 'cash-on-delivery']);
  });

  it('exposes PAYMENT_STATUSES', () => {
    expect(PAYMENT_STATUSES).toEqual(['pending', 'paid', 'failed', 'refunded']);
  });

  it('maps PaymentMethod wire ⇄ db', () => {
    expect(paymentMethodToDb('card')).toBe('CARD');
    expect(paymentMethodToDb('cash-on-delivery')).toBe('CASH_ON_DELIVERY');
    expect(paymentMethodFromDb('CASH_ON_DELIVERY')).toBe('cash-on-delivery');
  });

  it('maps PaymentStatus wire ⇄ db', () => {
    expect(paymentStatusToDb('paid')).toBe('PAID');
    expect(paymentStatusFromDb('REFUNDED')).toBe('refunded');
  });

  it('payInitiateSchema: parses card with default outcome', () => {
    const result = payInitiateSchema.safeParse({ method: 'card' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.method).toBe('card');
      expect(result.data.cardOutcome).toBe('success');
    }
  });

  it('payInitiateSchema: parses card with explicit fail outcome', () => {
    const result = payInitiateSchema.safeParse({ method: 'card', cardOutcome: 'fail' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cardOutcome).toBe('fail');
  });

  it('payInitiateSchema: parses cash-on-delivery without cardOutcome', () => {
    const result = payInitiateSchema.safeParse({ method: 'cash-on-delivery' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.method).toBe('cash-on-delivery');
  });

  it('payInitiateSchema: rejects unknown method', () => {
    const result = payInitiateSchema.safeParse({ method: 'bitcoin' });
    expect(result.success).toBe(false);
  });

  it('payInitiateSchema: rejects invalid cardOutcome', () => {
    const result = payInitiateSchema.safeParse({ method: 'card', cardOutcome: 'maybe' });
    expect(result.success).toBe(false);
  });

  // ---- ReturnCondition enum + mappers -------------------------------------
  it('exposes RETURN_CONDITIONS', () => {
    expect(RETURN_CONDITIONS).toEqual(['clean', 'minor-damage', 'major-damage']);
  });

  it('maps ReturnCondition wire ⇄ db', () => {
    expect(returnConditionToDb('clean')).toBe('CLEAN');
    expect(returnConditionToDb('minor-damage')).toBe('MINOR_DAMAGE');
    expect(returnConditionToDb('major-damage')).toBe('MAJOR_DAMAGE');
    expect(returnConditionFromDb('MINOR_DAMAGE')).toBe('minor-damage');
  });

  // ---- otpVerifySchema ----------------------------------------------------
  it('otpVerifySchema: accepts a valid 6-digit code', () => {
    expect(otpVerifySchema.safeParse({ code: '123456' }).success).toBe(true);
  });

  it('otpVerifySchema: rejects a 5-digit code', () => {
    expect(otpVerifySchema.safeParse({ code: '12345' }).success).toBe(false);
  });

  it('otpVerifySchema: rejects a 7-digit code', () => {
    expect(otpVerifySchema.safeParse({ code: '1234567' }).success).toBe(false);
  });

  it('otpVerifySchema: rejects non-numeric characters', () => {
    expect(otpVerifySchema.safeParse({ code: '12345a' }).success).toBe(false);
  });

  // ---- contractSignSchema -------------------------------------------------
  it('contractSignSchema: accepts a valid signature with agree=true', () => {
    const result = contractSignSchema.safeParse({ signatureName: 'John Doe', agree: true });
    expect(result.success).toBe(true);
  });

  it('contractSignSchema: rejects empty signatureName', () => {
    const result = contractSignSchema.safeParse({ signatureName: '', agree: true });
    expect(result.success).toBe(false);
  });

  it('contractSignSchema: rejects agree=false', () => {
    const result = contractSignSchema.safeParse({ signatureName: 'John Doe', agree: false });
    expect(result.success).toBe(false);
  });

  it('contractSignSchema: rejects missing agree field', () => {
    const result = contractSignSchema.safeParse({ signatureName: 'John Doe' });
    expect(result.success).toBe(false);
  });

  // ---- inspectionSchema ---------------------------------------------------
  it('inspectionSchema: accepts valid condition with notes', () => {
    const result = inspectionSchema.safeParse({ condition: 'minor-damage', notes: 'Scratch on bumper' });
    expect(result.success).toBe(true);
  });

  it('inspectionSchema: accepts valid condition without notes', () => {
    const result = inspectionSchema.safeParse({ condition: 'clean' });
    expect(result.success).toBe(true);
  });

  it('inspectionSchema: rejects invalid condition', () => {
    const result = inspectionSchema.safeParse({ condition: 'totaled' });
    expect(result.success).toBe(false);
  });
});
