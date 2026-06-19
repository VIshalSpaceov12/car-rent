import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth/storage', () => ({ getToken: vi.fn().mockResolvedValue(null) }));
import { login, me, listVehicles, getVehicle, quoteBooking, createBooking, listBookings } from './client';
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
