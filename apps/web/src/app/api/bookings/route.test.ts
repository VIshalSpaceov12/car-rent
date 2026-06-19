import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';
import { signJwt } from '@/server/auth/jwt';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

import { headers } from 'next/headers';

function authedReq(method: string, url: string, body?: unknown, token?: string): Request {
  return new Request(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function mockAuth(token: string) {
  vi.mocked(headers).mockResolvedValue({
    get: (name: string) => (name === 'authorization' ? `Bearer ${token}` : null),
  } as never);
}
function mockNoAuth() {
  vi.mocked(headers).mockResolvedValue({ get: () => null } as never);
}

let customerToken: string;
let providerToken: string;
let vehicleId: string;
let vehicleProviderId: string;
let createdBookingId: string;
let maintenanceVehicleId: string;

beforeAll(async () => {
  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);
  vehicleProviderId = provider.providerId!;

  // Get an ACTIVE vehicle from this provider
  const vehicle = await prisma.vehicle.findFirst({
    where: { providerId: vehicleProviderId, status: 'ACTIVE' },
  });
  if (!vehicle) throw new Error('No ACTIVE vehicle seeded for drivehub provider');
  vehicleId = vehicle.id;

  // Create a MAINTENANCE vehicle to test the unavailability guard
  const category = await prisma.vehicleCategory.findFirst({ where: { providerId: vehicleProviderId } });
  if (!category) throw new Error('No vehicle category seeded for provider');
  const maintenanceVehicle = await prisma.vehicle.create({
    data: {
      providerId: vehicleProviderId,
      categoryId: category.id,
      name: 'Test Maintenance Vehicle',
      status: 'MAINTENANCE',
      pricePerDay: 100,
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      year: 2023,
    },
  });
  maintenanceVehicleId = maintenanceVehicle.id;
});

afterAll(async () => {
  if (createdBookingId) {
    await prisma.booking.delete({ where: { id: createdBookingId } }).catch(() => {});
  }
  if (maintenanceVehicleId) {
    await prisma.vehicle.delete({ where: { id: maintenanceVehicleId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

import { GET, POST } from './route';

describe('POST /api/bookings — create booking', () => {
  it('creates booking with RESERVED status and server-computed amounts (ignores client amounts)', async () => {
    mockAuth(customerToken);
    const payload = {
      vehicleId,
      startDate: '2025-06-01',
      endDate: '2025-06-04', // 3 days
      plan: 'daily',
      // client tries to send forged amounts — should be ignored
      totalAmount: 0,
      baseAmount: 0,
    };
    const req = authedReq('POST', 'http://localhost/api/bookings', payload);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    createdBookingId = body.id;

    expect(body.status).toBe('reserved');
    expect(body.vehicle.id).toBe(vehicleId);
    // server-computed total should NOT be 0
    expect(body.totalAmount).toBeGreaterThan(0);
    expect(body.baseAmount).toBeGreaterThan(0);

    // Verify in DB
    const db = await prisma.booking.findUnique({ where: { id: body.id } });
    expect(db).not.toBeNull();
    expect(db!.status).toBe('RESERVED');
    expect(db!.customerId).toBeTruthy();
    // providerId must come from vehicle, not client
    expect(db!.providerId).toBe(vehicleProviderId);
  });

  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const req = authedReq('POST', 'http://localhost/api/bookings', {
      vehicleId, startDate: '2025-06-01', endDate: '2025-06-04', plan: 'daily',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when a provider tries to create a booking (customers only)', async () => {
    mockAuth(providerToken);
    const req = authedReq('POST', 'http://localhost/api/bookings', {
      vehicleId, startDate: '2025-06-01', endDate: '2025-06-04', plan: 'daily',
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown vehicleId', async () => {
    mockAuth(customerToken);
    const req = authedReq('POST', 'http://localhost/api/bookings', {
      vehicleId: 'nonexistent-id', startDate: '2025-06-01', endDate: '2025-06-04', plan: 'daily',
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 422 when dates are invalid (endDate <= startDate)', async () => {
    mockAuth(customerToken);
    const req = authedReq('POST', 'http://localhost/api/bookings', {
      vehicleId, startDate: '2025-06-04', endDate: '2025-06-01', plan: 'daily',
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns 400 on invalid body', async () => {
    mockAuth(customerToken);
    const req = authedReq('POST', 'http://localhost/api/bookings', { vehicleId });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 422 when vehicle is not ACTIVE (MAINTENANCE)', async () => {
    mockAuth(customerToken);
    const req = authedReq('POST', 'http://localhost/api/bookings', {
      vehicleId: maintenanceVehicleId,
      startDate: '2025-06-01',
      endDate: '2025-06-04',
      plan: 'daily',
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('vehicle_not_available');
  });
});

describe('GET /api/bookings', () => {
  it('customer sees only their own bookings', async () => {
    mockAuth(customerToken);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // All returned bookings belong to this customer
    const db = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
    for (const b of body) {
      const dbBooking = await prisma.booking.findUnique({ where: { id: b.id } });
      expect(dbBooking?.customerId).toBe(db!.id);
    }
  });

  it('provider sees tenant bookings', async () => {
    mockAuth(providerToken);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const b of body) {
      const dbBooking = await prisma.booking.findUnique({ where: { id: b.id } });
      expect(dbBooking?.providerId).toBe(vehicleProviderId);
    }
  });

  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
