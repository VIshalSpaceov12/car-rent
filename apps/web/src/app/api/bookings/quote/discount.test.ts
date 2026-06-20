import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';
import { signJwt } from '@/server/auth/jwt';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: async () => ({ get: () => undefined }),
}));

import { headers } from 'next/headers';

function mockAuth(token: string) {
  vi.mocked(headers).mockResolvedValue({
    get: (name: string) => (name === 'authorization' ? `Bearer ${token}` : null),
  } as never);
}

function postReq(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let customerToken: string;
let vehicleId: string;
let providerId: string;
let percentCodeId: string;
let fixedCodeId: string;
let expiredCodeId: string;

beforeAll(async () => {
  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerId = provider.providerId!;

  const vehicle = await prisma.vehicle.findFirst({
    where: { providerId, status: 'ACTIVE' },
  });
  if (!vehicle) throw new Error('No ACTIVE vehicle');
  vehicleId = vehicle.id;

  // Create test discount codes
  const pct = await prisma.discountCode.create({
    data: { providerId, code: 'TESTPCT10', kind: 'PERCENT', value: 10, active: true },
  });
  percentCodeId = pct.id;

  const fixed = await prisma.discountCode.create({
    data: { providerId, code: 'TESTFIXED20', kind: 'FIXED', value: 20, active: true },
  });
  fixedCodeId = fixed.id;

  const expired = await prisma.discountCode.create({
    data: {
      providerId, code: 'TESTEXPIRED', kind: 'PERCENT', value: 50, active: true,
      expiresAt: new Date('2020-01-01'),
    },
  });
  expiredCodeId = expired.id;
});

afterAll(async () => {
  await prisma.discountCode.deleteMany({ where: { id: { in: [percentCodeId, fixedCodeId, expiredCodeId] } } });
  await prisma.$disconnect();
});

import { POST } from './route';

describe('POST /api/bookings/quote — discount codes', () => {
  const basePayload = {
    vehicleId: '',
    startDate: '2027-01-01',
    endDate: '2027-01-04', // 3 days
    plan: 'daily',
  };

  it('returns base quote without discount when no code provided', async () => {
    mockAuth(customerToken);
    const res = await POST(postReq('http://localhost/api/bookings/quote', { ...basePayload, vehicleId }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.discountApplied).toBeUndefined();
  });

  it('applies percent discount correctly', async () => {
    mockAuth(customerToken);
    const baseRes = await POST(postReq('http://localhost/api/bookings/quote', { ...basePayload, vehicleId }));
    const base = await baseRes.json();

    const discountRes = await POST(postReq('http://localhost/api/bookings/quote', {
      ...basePayload, vehicleId, discountCode: 'TESTPCT10',
    }));
    expect(discountRes.status).toBe(200);
    const body = await discountRes.json();
    expect(body.discountApplied).toBe(true);
    expect(body.discountCode).toBe('TESTPCT10');
    expect(body.total).toBeLessThan(base.total);
    // 10% off subtotal
    const expectedDiscountAmount = Math.round(base.subtotal * 10) / 100;
    expect(body.discountAmount).toBeCloseTo(expectedDiscountAmount, 1);
  });

  it('applies fixed discount correctly', async () => {
    mockAuth(customerToken);
    const baseRes = await POST(postReq('http://localhost/api/bookings/quote', { ...basePayload, vehicleId }));
    const base = await baseRes.json();

    const discountRes = await POST(postReq('http://localhost/api/bookings/quote', {
      ...basePayload, vehicleId, discountCode: 'TESTFIXED20',
    }));
    expect(discountRes.status).toBe(200);
    const body = await discountRes.json();
    expect(body.discountApplied).toBe(true);
    expect(body.discountAmount).toBeCloseTo(20, 1);
    expect(body.total).toBeLessThan(base.total);
  });

  it('returns base quote (discountApplied: false) for expired code', async () => {
    mockAuth(customerToken);
    const res = await POST(postReq('http://localhost/api/bookings/quote', {
      ...basePayload, vehicleId, discountCode: 'TESTEXPIRED',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.discountApplied).toBe(false);
  });

  it('returns base quote (discountApplied: false) for invalid code', async () => {
    mockAuth(customerToken);
    const res = await POST(postReq('http://localhost/api/bookings/quote', {
      ...basePayload, vehicleId, discountCode: 'INVALIDCODE999',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.discountApplied).toBe(false);
  });
});
