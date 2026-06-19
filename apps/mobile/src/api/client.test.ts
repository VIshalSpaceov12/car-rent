import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth/storage', () => ({ getToken: vi.fn().mockResolvedValue(null) }));
import { login, me, listVehicles, getVehicle, quoteBooking, createBooking, listBookings, payBooking, verifyOtp, signContract } from './client';
import { getToken } from '@/auth/storage';

describe('mobile api client', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('POSTs credentials and returns null on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as never;
    expect(await login('x@y.z', 'bad')).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/login'), expect.objectContaining({ method: 'POST' }));
  });
});

describe('me()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns the user and sends Authorization header on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const mockUser = { id: 'u1', role: 'customer', email: 'a@b.com', name: 'A', providerId: null, locale: 'en' };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockUser }) as never;
    const result = await me();
    expect(result).toEqual(mockUser);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer tok123' }),
      }),
    );
  });

  it('returns null on 401', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as never;
    expect(await me()).toBeNull();
  });
});

describe('listVehicles()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls GET /api/vehicles and returns array', async () => {
    const mockVehicles = [
      { id: 'v1', name: 'Toyota Camry', transmission: 'automatic', fuelType: 'petrol', pricePerDay: 50 },
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockVehicles }) as never;
    const result = await listVehicles();
    expect(result).toEqual(mockVehicles);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/vehicles'), expect.any(Object));
  });

  it('builds query string from query params', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }) as never;
    await listVehicles({ q: 'camry', transmission: 'automatic', minPrice: 30 });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(url).toContain('q=camry');
    expect(url).toContain('transmission=automatic');
    expect(url).toContain('minPrice=30');
  });

  it('returns empty array on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as never;
    expect(await listVehicles()).toEqual([]);
  });
});

describe('getVehicle()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns vehicle object on 200', async () => {
    const mockVehicle = { id: 'v1', name: 'Toyota Camry', transmission: 'automatic', fuelType: 'petrol', pricePerDay: 50 };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockVehicle }) as never;
    const result = await getVehicle('v1');
    expect(result).toEqual(mockVehicle);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/vehicles/v1'), expect.any(Object));
  });

  it('returns null on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as never;
    expect(await getVehicle('not-found')).toBeNull();
  });

  it('returns null on other non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as never;
    expect(await getVehicle('v1')).toBeNull();
  });
});

describe('quoteBooking()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('POSTs request and returns quote on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const mockQuote = {
      days: 3,
      baseRatePerDay: 50,
      planMultiplier: 1,
      seasonalMultiplier: 1,
      subtotal: 150,
      taxRatePct: 5,
      taxAmount: 7.5,
      serviceCharge: 10,
      total: 167.5,
      currency: 'USD',
    };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockQuote }) as never;
    const req = { vehicleId: 'v1', startDate: '2025-01-01', endDate: '2025-01-04', plan: 'daily' as const };
    const result = await quoteBooking(req);
    expect(result).toEqual(mockQuote);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bookings/quote'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(req) }),
    );
  });

  it('returns null on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) }) as never;
    const result = await quoteBooking({ vehicleId: 'v1', startDate: '2025-01-01', endDate: '2025-01-04', plan: 'daily' as const });
    expect(result).toBeNull();
  });
});

describe('createBooking()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('POSTs request and returns BookingDTO on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const mockBooking: import('@car-rental/types').BookingDTO = {
      id: 'b1',
      status: 'reserved',
      vehicle: { id: 'v1', name: 'Toyota Camry' },
      startDate: '2025-01-01',
      endDate: '2025-01-04',
      plan: 'daily',
      baseAmount: 150,
      taxAmount: 7.5,
      serviceCharge: 10,
      totalAmount: 167.5,
      currency: 'USD',
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockBooking }) as never;
    const req = { vehicleId: 'v1', startDate: '2025-01-01', endDate: '2025-01-04', plan: 'daily' as const };
    const result = await createBooking(req);
    expect(result).toEqual(mockBooking);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bookings'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(req) }),
    );
  });

  it('returns null on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({}) }) as never;
    const result = await createBooking({ vehicleId: 'v1', startDate: '2025-01-01', endDate: '2025-01-04', plan: 'daily' as const });
    expect(result).toBeNull();
  });
});

describe('listBookings()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls GET /api/bookings and returns array', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const mockBookings = [
      { id: 'b1', status: 'reserved', vehicle: { id: 'v1', name: 'Camry' }, startDate: '2025-01-01', endDate: '2025-01-04', plan: 'daily', baseAmount: 150, taxAmount: 7.5, serviceCharge: 10, totalAmount: 167.5, currency: 'USD', createdAt: '2025-01-01T00:00:00.000Z' },
    ];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockBookings }) as never;
    const result = await listBookings();
    expect(result).toEqual(mockBookings);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/bookings'), expect.any(Object));
  });

  it('returns empty array on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as never;
    expect(await listBookings()).toEqual([]);
  });
});

describe('payBooking()', () => {
  beforeEach(() => vi.resetAllMocks());

  const mockPayment: import('@car-rental/types').PaymentDTO = {
    id: 'pay1',
    bookingId: 'b1',
    amount: 167.5,
    currency: 'USD',
    method: 'card',
    status: 'paid',
    createdAt: '2025-01-01T00:00:00.000Z',
  };
  const mockBooking: import('@car-rental/types').BookingDTO = {
    id: 'b1',
    status: 'confirmed',
    vehicle: { id: 'v1', name: 'Toyota Camry' },
    startDate: '2025-01-01',
    endDate: '2025-01-04',
    plan: 'daily',
    baseAmount: 150,
    taxAmount: 7.5,
    serviceCharge: 10,
    totalAmount: 167.5,
    currency: 'USD',
    createdAt: '2025-01-01T00:00:00.000Z',
    payment: mockPayment,
  };

  it('POSTs method+cardOutcome and returns payment+booking on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ payment: mockPayment, booking: mockBooking }),
    }) as never;

    const result = await payBooking('b1', { method: 'card', cardOutcome: 'success' });
    expect(result).toEqual({ payment: mockPayment, booking: mockBooking });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bookings/b1/pay'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ method: 'card', cardOutcome: 'success' }),
      }),
    );
  });

  it('sends Authorization header with stored token', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-pay');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ payment: mockPayment, booking: mockBooking }),
    }) as never;
    await payBooking('b1', { method: 'cash-on-delivery' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer tok-pay' }),
      }),
    );
  });

  it('returns null on 409 (already paid)', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({}) }) as never;
    expect(await payBooking('b1', { method: 'card', cardOutcome: 'success' })).toBeNull();
  });

  it('returns null on mock card failure (402 / non-ok)', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 402, json: async () => ({}) }) as never;
    expect(await payBooking('b1', { method: 'card', cardOutcome: 'fail' })).toBeNull();
  });
});

describe('verifyOtp()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('POSTs code to correct endpoint and returns verified:true on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ verified: true }),
    }) as never;

    const result = await verifyOtp('b1', '123456');
    expect(result).toEqual({ verified: true });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bookings/b1/otp/verify'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: '123456' }),
      }),
    );
  });

  it('sends Authorization header with stored token', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-otp');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ verified: true }),
    }) as never;
    await verifyOtp('b1', '654321');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer tok-otp' }),
      }),
    );
  });

  it('returns error object on 422 (otp_invalid)', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const errBody = { error: 'otp_invalid', message: 'Invalid OTP' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => errBody,
    }) as never;

    const result = await verifyOtp('b1', '000000');
    expect(result).toEqual(errBody);
  });

  it('returns error object on 422 (otp_locked)', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const errBody = { error: 'otp_locked', message: 'Too many attempts' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => errBody,
    }) as never;

    const result = await verifyOtp('b1', '000000');
    expect(result).toEqual(errBody);
  });
});

describe('signContract()', () => {
  beforeEach(() => vi.resetAllMocks());

  const mockContract: import('@car-rental/types').ContractDTO = {
    id: 'c1',
    bookingId: 'b1',
    signedAt: '2025-01-01T12:00:00.000Z',
    signatureName: 'Jane Doe',
    termsVersion: '1.0',
  };
  const mockBooking: import('@car-rental/types').BookingDTO = {
    id: 'b1',
    status: 'picked-up',
    vehicle: { id: 'v1', name: 'Toyota Camry' },
    startDate: '2025-01-01',
    endDate: '2025-01-04',
    plan: 'daily',
    baseAmount: 150,
    taxAmount: 7.5,
    serviceCharge: 10,
    totalAmount: 167.5,
    currency: 'USD',
    createdAt: '2025-01-01T00:00:00.000Z',
  };

  it('POSTs signatureName+agree and returns contract+booking on 201', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ contract: mockContract, booking: mockBooking }),
    }) as never;

    const result = await signContract('b1', { signatureName: 'Jane Doe', agree: true });
    expect(result).toEqual({ contract: mockContract, booking: mockBooking });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bookings/b1/contract/sign'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ signatureName: 'Jane Doe', agree: true }),
      }),
    );
  });

  it('sends Authorization header', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-sign');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ contract: mockContract, booking: mockBooking }),
    }) as never;
    await signContract('b1', { signatureName: 'Jane Doe', agree: true });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer tok-sign' }),
      }),
    );
  });

  it('returns null on 422 (contract already signed)', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'contract_already_signed' }),
    }) as never;
    expect(await signContract('b1', { signatureName: 'Jane Doe', agree: true })).toBeNull();
  });
});
