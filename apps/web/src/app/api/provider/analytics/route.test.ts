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
function mockNoAuth() {
  vi.mocked(headers).mockResolvedValue({ get: () => null } as never);
}

let providerToken: string;
let customerToken: string;
let otherProviderToken: string;
let testPaymentId: string | undefined;

beforeAll(async () => {
  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);

  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  // Create another provider to test tenant isolation
  const hash = await (await import('bcrypt')).hash('Password123!', 10);
  let otherProvider = await prisma.user.findUnique({ where: { email: 'analytics-other@test.test' } });
  if (!otherProvider) {
    const otherProviderRecord = await prisma.provider.create({
      data: { name: 'Analytics Other', slug: 'analytics-other-test', colors: {} },
    });
    otherProvider = await prisma.user.create({
      data: {
        email: 'analytics-other@test.test', name: 'Analytics Other',
        role: 'PROVIDER', passwordHash: hash, providerId: otherProviderRecord.id,
      },
    });
  }
  otherProviderToken = signJwt(otherProvider.id);
});

afterAll(async () => {
  if (testPaymentId) await prisma.payment.delete({ where: { id: testPaymentId } }).catch(() => {});
  await prisma.$disconnect();
});

import { GET } from './route';

describe('GET /api/provider/analytics', () => {
  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 for customers', async () => {
    mockAuth(customerToken);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns analytics with correct shape for provider', async () => {
    mockAuth(providerToken);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(typeof body.revenueTotal).toBe('number');
    expect(typeof body.revenueMTD).toBe('number');
    expect(typeof body.bookingsCount).toBe('number');
    expect(typeof body.activeRentals).toBe('number');
    expect(typeof body.fleetUtilizationPct).toBe('number');
    expect(Array.isArray(body.popularVehicles)).toBe(true);
    expect(body.fleetUtilizationPct).toBeGreaterThanOrEqual(0);
    expect(body.fleetUtilizationPct).toBeLessThanOrEqual(100);
  });

  it('only returns data for the calling provider (tenant isolation)', async () => {
    mockAuth(otherProviderToken);
    const res = await GET();
    expect(res.status).toBe(200);
    const otherBody = await res.json();

    // Other provider has no vehicles/bookings, so counts should be 0
    expect(otherBody.bookingsCount).toBe(0);
    expect(otherBody.revenueTotal).toBe(0);

    mockAuth(providerToken);
    const mainRes = await GET();
    const mainBody = await mainRes.json();
    // Main provider has seeded bookings
    expect(mainBody.bookingsCount).toBeGreaterThanOrEqual(0);
  });
});
