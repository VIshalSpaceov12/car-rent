/**
 * Integration tests for GET /api/admin/analytics
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';
import { signJwt } from '@/server/auth/jwt';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: async () => ({ get: () => undefined }),
}));

import { headers } from 'next/headers';
import { GET } from './route';

function mockAuth(token: string) {
  vi.mocked(headers).mockResolvedValue({
    get: (name: string) => (name === 'authorization' ? `Bearer ${token}` : null),
  } as never);
}
function mockNoAuth() {
  vi.mocked(headers).mockResolvedValue({ get: () => null } as never);
}

let adminToken: string;
let providerToken: string;
let customerToken: string;

beforeAll(async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@demo.test' } });
  if (!admin) throw new Error('admin@demo.test not seeded');
  adminToken = signJwt(admin.id);

  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);

  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Authorization — GET /api/admin/analytics', () => {
  it('rejects unauthenticated (401)', async () => {
    mockNoAuth();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('rejects customer (403)', async () => {
    mockAuth(customerToken);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('rejects provider role (403)', async () => {
    mockAuth(providerToken);
    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/analytics — cross-tenant aggregates', () => {
  it('returns platform-wide analytics with correct shape', async () => {
    mockAuth(adminToken);
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body.providersTotal).toBe('number');
    expect(typeof body.providersActive).toBe('number');
    expect(typeof body.bookingsTotal).toBe('number');
    expect(typeof body.revenueTotal).toBe('number');
    expect(typeof body.activeRentals).toBe('number');
    expect(Array.isArray(body.topProviders)).toBe(true);

    // Platform has at least 2 providers (drivehub + sunset-rentals from seed)
    expect(body.providersTotal).toBeGreaterThanOrEqual(2);
  });

  it('topProviders aggregates across all tenants', async () => {
    mockAuth(adminToken);
    const res = await GET();
    const body = await res.json();

    // driveHub should appear since it has bookings
    expect(body.topProviders.length).toBeGreaterThanOrEqual(1);
    for (const tp of body.topProviders) {
      expect(tp.id).toBeTruthy();
      expect(tp.name).toBeTruthy();
      expect(typeof tp.bookingsCount).toBe('number');
      expect(typeof tp.revenue).toBe('number');
    }
  });

  it('providersActive is <= providersTotal', async () => {
    mockAuth(adminToken);
    const res = await GET();
    const body = await res.json();
    expect(body.providersActive).toBeLessThanOrEqual(body.providersTotal);
  });
});
