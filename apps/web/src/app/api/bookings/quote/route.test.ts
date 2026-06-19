import { describe, it, expect, vi, beforeAll } from 'vitest';
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
let vehicleId: string;

beforeAll(async () => {
  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  const vehicle = await prisma.vehicle.findFirst({
    where: { providerId: provider!.providerId!, status: 'ACTIVE' },
  });
  if (!vehicle) throw new Error('No ACTIVE vehicle seeded');
  vehicleId = vehicle.id;
});

import { POST } from './route';

describe('POST /api/bookings/quote', () => {
  it('returns a valid quote with correct math for any logged-in user', async () => {
    mockAuth(customerToken);
    const pricePerDay = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    const settings = await prisma.businessSettings.findFirst({
      where: { providerId: pricePerDay!.providerId },
    });

    const req = authedReq('POST', 'http://localhost/api/bookings/quote', {
      vehicleId,
      startDate: '2025-07-01',
      endDate: '2025-07-04', // 3 days
      plan: 'daily',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.days).toBe(3);
    expect(body.planMultiplier).toBe(1);
    expect(body.subtotal).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(body.subtotal - 0.01); // total >= subtotal
    expect(body.currency).toBe(settings?.currency ?? 'USD');
    expect(typeof body.taxRatePct).toBe('number');
    expect(typeof body.serviceCharge).toBe('number');
    expect(typeof body.taxAmount).toBe('number');
  });

  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const req = authedReq('POST', 'http://localhost/api/bookings/quote', {
      vehicleId, startDate: '2025-07-01', endDate: '2025-07-04', plan: 'daily',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown vehicleId', async () => {
    mockAuth(customerToken);
    const req = authedReq('POST', 'http://localhost/api/bookings/quote', {
      vehicleId: 'does-not-exist', startDate: '2025-07-01', endDate: '2025-07-04', plan: 'daily',
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 422 for invalid date range', async () => {
    mockAuth(customerToken);
    const req = authedReq('POST', 'http://localhost/api/bookings/quote', {
      vehicleId, startDate: '2025-07-04', endDate: '2025-07-01', plan: 'daily',
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns 400 for missing fields', async () => {
    mockAuth(customerToken);
    const req = authedReq('POST', 'http://localhost/api/bookings/quote', { vehicleId });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
