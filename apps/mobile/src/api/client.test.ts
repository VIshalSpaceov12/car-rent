import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth/storage', () => ({ getToken: vi.fn().mockResolvedValue(null) }));
import {
  login, me, listVehicles, getVehicle, quoteBooking, createBooking, listBookings,
  payBooking, verifyOtp, signContract, returnVehicle,
  rebookBooking, getLoyalty,
  listAddresses, createAddress, updateAddress, deleteAddress,
  createSupportTicket, listSupportTickets,
} from './client';
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

  it('returns error object on 422 (invalid)', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const errBody = { error: 'invalid', message: 'Invalid OTP' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => errBody,
    }) as never;

    const result = await verifyOtp('b1', '000000');
    expect(result).toEqual(errBody);
  });

  it('returns error object on 422 (locked)', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const errBody = { error: 'locked', message: 'Too many attempts' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => errBody,
    }) as never;

    const result = await verifyOtp('b1', '000000');
    expect(result).toEqual(errBody);
  });

  it('returns error object on 422 (expired)', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const errBody = { error: 'expired', message: 'OTP has expired' };
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

describe('returnVehicle()', () => {
  beforeEach(() => vi.resetAllMocks());

  const mockBooking: import('@car-rental/types').BookingDTO = {
    id: 'b1',
    status: 'returned',
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

  it('returns BookingDTO on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockBooking,
    }) as never;

    const result = await returnVehicle('b1');
    expect(result).toEqual(mockBooking);
  });

  it('returns null on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'invalid_status' }),
    }) as never;

    const result = await returnVehicle('b1');
    expect(result).toBeNull();
  });

  it('sends Authorization header to /api/bookings/:id/return', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-return');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockBooking,
    }) as never;

    await returnVehicle('b1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bookings/b1/return'),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer tok-return' }),
      }),
    );
  });
});

describe('rebookBooking()', () => {
  beforeEach(() => vi.resetAllMocks());

  const mockNewBooking: import('@car-rental/types').BookingDTO = {
    id: 'b2',
    status: 'reserved',
    vehicle: { id: 'v1', name: 'Toyota Camry' },
    startDate: '2025-02-01',
    endDate: '2025-02-04',
    plan: 'daily',
    baseAmount: 150,
    taxAmount: 7.5,
    serviceCharge: 10,
    totalAmount: 167.5,
    currency: 'USD',
    createdAt: '2025-02-01T00:00:00.000Z',
  };

  it('POSTs to /api/bookings/:id/rebook and returns new BookingDTO on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockNewBooking,
    }) as never;

    const result = await rebookBooking('b1');
    expect(result).toEqual(mockNewBooking);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bookings/b1/rebook'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns null on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'not_completed' }),
    }) as never;

    const result = await rebookBooking('b1');
    expect(result).toBeNull();
  });

  it('sends Authorization header', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-rebook');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockNewBooking,
    }) as never;

    await rebookBooking('b1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer tok-rebook' }),
      }),
    );
  });
});

describe('getLoyalty()', () => {
  beforeEach(() => vi.resetAllMocks());

  const mockLoyalty = {
    account: {
      id: 'la1',
      userId: 'u1',
      points: 250,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-10T00:00:00.000Z',
    },
    entries: [
      {
        id: 'le1',
        userId: 'u1',
        delta: 100,
        reason: 'Rental completed',
        bookingId: 'b1',
        createdAt: '2025-01-10T00:00:00.000Z',
      },
    ],
  };

  it('GETs /api/loyalty and returns loyalty data on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockLoyalty,
    }) as never;

    const result = await getLoyalty();
    expect(result).toEqual(mockLoyalty);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/loyalty'),
      expect.any(Object),
    );
  });

  it('returns null on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    }) as never;

    expect(await getLoyalty()).toBeNull();
  });

  it('sends Authorization header', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-loyalty');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockLoyalty,
    }) as never;

    await getLoyalty();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer tok-loyalty' }),
      }),
    );
  });
});

describe('quoteBooking() with discountCode', () => {
  beforeEach(() => vi.resetAllMocks());

  it('includes discountCode in the request body when provided', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const mockQuote = {
      days: 3, baseRatePerDay: 50, planMultiplier: 1, seasonalMultiplier: 1,
      subtotal: 120, taxRatePct: 5, taxAmount: 6, serviceCharge: 10, total: 136, currency: 'USD',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => mockQuote,
    }) as never;

    const req = { vehicleId: 'v1', startDate: '2025-01-01', endDate: '2025-01-04', plan: 'daily' as const };
    await quoteBooking(req, 'SAVE20');

    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body as string,
    ) as Record<string, unknown>;
    expect(body.discountCode).toBe('SAVE20');
  });

  it('omits discountCode when not provided', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const mockQuote = {
      days: 3, baseRatePerDay: 50, planMultiplier: 1, seasonalMultiplier: 1,
      subtotal: 150, taxRatePct: 5, taxAmount: 7.5, serviceCharge: 10, total: 167.5, currency: 'USD',
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => mockQuote,
    }) as never;

    const req = { vehicleId: 'v1', startDate: '2025-01-01', endDate: '2025-01-04', plan: 'daily' as const };
    await quoteBooking(req);

    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body as string,
    ) as Record<string, unknown>;
    expect(body.discountCode).toBeUndefined();
  });
});

// ---- Saved Addresses -------------------------------------------------------

const mockAddress: import('@car-rental/types').AddressDTO = {
  id: 'addr1',
  userId: 'u1',
  label: 'Home',
  line1: '123 Main St',
  city: 'Dubai',
  country: 'AE',
  isDefault: true,
  createdAt: '2025-01-01T00:00:00.000Z',
};

describe('listAddresses()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('GETs /api/addresses and returns array on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [mockAddress] }) as never;
    const result = await listAddresses();
    expect(result).toEqual([mockAddress]);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/addresses'), expect.any(Object));
  });

  it('returns empty array on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as never;
    expect(await listAddresses()).toEqual([]);
  });

  it('sends Authorization header', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-addr');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }) as never;
    await listAddresses();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer tok-addr' }) }),
    );
  });
});

describe('createAddress()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('POSTs to /api/addresses and returns AddressDTO on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockAddress }) as never;
    const input = { label: 'Home', line1: '123 Main St', city: 'Dubai', country: 'AE', isDefault: true };
    const result = await createAddress(input);
    expect(result).toEqual(mockAddress);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/addresses'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('returns null on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) }) as never;
    expect(await createAddress({ label: 'Work', line1: '1 Ave', city: 'Dubai', country: 'AE', isDefault: false })).toBeNull();
  });

  it('sends Authorization header', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-create-addr');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockAddress }) as never;
    await createAddress({ label: 'Home', line1: '1 St', city: 'Dubai', country: 'AE', isDefault: false });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer tok-create-addr' }) }),
    );
  });
});

describe('updateAddress()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('PATCHes /api/addresses/:id and returns updated AddressDTO on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const updated = { ...mockAddress, label: 'Office' };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => updated }) as never;
    const result = await updateAddress('addr1', { label: 'Office' });
    expect(result).toEqual(updated);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/addresses/addr1'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ label: 'Office' }) }),
    );
  });

  it('returns null on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as never;
    expect(await updateAddress('addr1', { label: 'X' })).toBeNull();
  });

  it('sends Authorization header', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-upd-addr');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockAddress }) as never;
    await updateAddress('addr1', { city: 'Abu Dhabi' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer tok-upd-addr' }) }),
    );
  });
});

describe('deleteAddress()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('DELETEs /api/addresses/:id and returns true on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }) as never;
    expect(await deleteAddress('addr1')).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/addresses/addr1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('returns false on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }) as never;
    expect(await deleteAddress('addr1')).toBe(false);
  });

  it('sends Authorization header', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-del-addr');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }) as never;
    await deleteAddress('addr1');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer tok-del-addr' }) }),
    );
  });
});

// ---- Support Tickets -------------------------------------------------------

const mockTicket: import('@car-rental/types').SupportTicketDTO = {
  id: 'tkt1',
  providerId: 'p1',
  userId: 'u1',
  subject: 'Billing issue',
  body: 'I was charged twice.',
  status: 'open',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('createSupportTicket()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('POSTs to /api/support and returns SupportTicketDTO on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockTicket }) as never;
    const input = { subject: 'Billing issue', body: 'I was charged twice.' };
    const result = await createSupportTicket(input);
    expect(result).toEqual(mockTicket);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/support'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('returns null on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) }) as never;
    expect(await createSupportTicket({ subject: 'X', body: 'Y' })).toBeNull();
  });

  it('sends Authorization header', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-tkt');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockTicket }) as never;
    await createSupportTicket({ subject: 'X', body: 'Y' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer tok-tkt' }) }),
    );
  });
});

describe('listSupportTickets()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('GETs /api/support and returns array on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [mockTicket] }) as never;
    const result = await listSupportTickets();
    expect(result).toEqual([mockTicket]);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/support'), expect.any(Object));
  });

  it('returns empty array on non-ok response', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as never;
    expect(await listSupportTickets()).toEqual([]);
  });

  it('sends Authorization header', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok-lst-tkt');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }) as never;
    await listSupportTickets();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer tok-lst-tkt' }) }),
    );
  });
});
