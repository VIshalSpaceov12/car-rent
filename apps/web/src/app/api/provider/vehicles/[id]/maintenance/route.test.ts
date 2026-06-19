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
function req(method: string, url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

let providerToken: string;
let customerToken: string;
let otherProviderToken: string;
let vehicleId: string;
let providerId: string;
let createdRecordIds: string[] = [];

beforeAll(async () => {
  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);
  providerId = provider.providerId!;

  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  // Create an isolated second provider for tenant scope tests
  const hash = await (await import('bcrypt')).hash('Password123!', 10);
  let otherProvider = await prisma.user.findUnique({ where: { email: 'maint-other@test.test' } });
  if (!otherProvider) {
    const otherProv = await prisma.provider.create({
      data: { name: 'Maint Other', slug: 'maint-other-test', colors: {} },
    });
    otherProvider = await prisma.user.create({
      data: {
        email: 'maint-other@test.test', name: 'Maint Other',
        role: 'PROVIDER', passwordHash: hash, providerId: otherProv.id,
      },
    });
  }
  otherProviderToken = signJwt(otherProvider.id);

  const vehicle = await prisma.vehicle.findFirst({ where: { providerId, status: 'ACTIVE' } });
  if (!vehicle) throw new Error('No ACTIVE vehicle');
  vehicleId = vehicle.id;
});

afterAll(async () => {
  if (createdRecordIds.length > 0) {
    await prisma.maintenanceRecord.deleteMany({ where: { id: { in: createdRecordIds } } });
  }
  await prisma.$disconnect();
});

import { GET, POST } from './route';

describe('GET /api/provider/vehicles/[id]/maintenance', () => {
  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await GET(
      req('GET', `http://localhost/api/provider/vehicles/${vehicleId}/maintenance`),
      { params: Promise.resolve({ id: vehicleId }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for customers', async () => {
    mockAuth(customerToken);
    const res = await GET(
      req('GET', `http://localhost/api/provider/vehicles/${vehicleId}/maintenance`),
      { params: Promise.resolve({ id: vehicleId }) }
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 when other provider tries to access (tenant isolation)', async () => {
    mockAuth(otherProviderToken);
    const res = await GET(
      req('GET', `http://localhost/api/provider/vehicles/${vehicleId}/maintenance`),
      { params: Promise.resolve({ id: vehicleId }) }
    );
    expect(res.status).toBe(404);
  });

  it('returns maintenance records for correct provider', async () => {
    mockAuth(providerToken);
    const res = await GET(
      req('GET', `http://localhost/api/provider/vehicles/${vehicleId}/maintenance`),
      { params: Promise.resolve({ id: vehicleId }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /api/provider/vehicles/[id]/maintenance', () => {
  it('creates a maintenance record for tenant vehicle', async () => {
    mockAuth(providerToken);
    const res = await POST(
      req('POST', `http://localhost/api/provider/vehicles/${vehicleId}/maintenance`, {
        description: 'Oil change',
        date: '2027-01-15',
        cost: 120.50,
      }),
      { params: Promise.resolve({ id: vehicleId }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    createdRecordIds.push(body.id);

    expect(body.vehicleId).toBe(vehicleId);
    expect(body.providerId).toBe(providerId);
    expect(body.description).toBe('Oil change');
    expect(body.cost).toBeCloseTo(120.5, 1);
  });

  it('returns 400 for invalid body', async () => {
    mockAuth(providerToken);
    const res = await POST(
      req('POST', `http://localhost/api/provider/vehicles/${vehicleId}/maintenance`, {}),
      { params: Promise.resolve({ id: vehicleId }) }
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when other provider tries to create (tenant isolation)', async () => {
    mockAuth(otherProviderToken);
    const res = await POST(
      req('POST', `http://localhost/api/provider/vehicles/${vehicleId}/maintenance`, {
        description: 'Cross-tenant attack', date: '2027-01-15',
      }),
      { params: Promise.resolve({ id: vehicleId }) }
    );
    expect(res.status).toBe(404);
  });
});
