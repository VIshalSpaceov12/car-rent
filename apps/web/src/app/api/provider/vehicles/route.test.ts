import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';
import { signJwt } from '@/server/auth/jwt';
import { transmissionToDb, fuelTypeToDb } from '@car-rental/types';

// Mock next/headers — the route handler uses cookies() but for Bearer-JWT tests
// we only need the headers mock; cookies is called by verifySession as fallback.
vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

import { headers } from 'next/headers';

// Helper: build a Request with Bearer token
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

// Set up mocked headers to return Bearer auth
function mockAuth(token: string) {
  vi.mocked(headers).mockResolvedValue({
    get: (name: string) => (name === 'authorization' ? `Bearer ${token}` : null),
  } as never);
}

function mockNoAuth() {
  vi.mocked(headers).mockResolvedValue({ get: () => null } as never);
}

// ---- test state -----------------------------------------------------------
let providerToken: string;
let providerProviderId: string;
let otherProviderProviderId: string;
let categoryId: string;
let branchId: string;
let createdVehicleId: string;

beforeAll(async () => {
  // Resolve provider@demo.test (seeded provider user)
  const providerUser = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!providerUser) throw new Error('provider@demo.test not found in DB — run npm run db:seed');
  providerToken = signJwt(providerUser.id);
  providerProviderId = providerUser.providerId!;

  // Get first category and branch for this provider
  const cat = await prisma.vehicleCategory.findFirst({ where: { providerId: providerProviderId } });
  if (!cat) throw new Error('No category found for provider — run npm run db:seed');
  categoryId = cat.id;

  const branch = await prisma.branch.findFirst({ where: { providerId: providerProviderId } });
  if (!branch) throw new Error('No branch found for provider — run npm run db:seed');
  branchId = branch.id;

  // Create a second isolated provider + user to test tenant isolation
  const otherProvider = await prisma.provider.upsert({
    where: { slug: 'test-other-provider' },
    update: {},
    create: {
      name: 'Other Provider',
      slug: 'test-other-provider',
      colors: { primary: 'black' },
    },
  });
  otherProviderProviderId = otherProvider.id;

  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('Password123!', 10);
  const otherUser = await prisma.user.upsert({
    where: { email: 'other-provider@test-isolation.test' },
    update: {},
    create: {
      email: 'other-provider@test-isolation.test',
      name: 'Other Provider User',
      role: 'PROVIDER',
      passwordHash: hash,
      providerId: otherProvider.id,
    },
  });
  void otherUser; // token not needed; otherProviderProviderId used for isolation assertion
});

afterAll(async () => {
  // Clean up test vehicles we created
  await prisma.vehicle.deleteMany({
    where: { providerId: otherProviderProviderId },
  });
  await prisma.user.deleteMany({
    where: { email: 'other-provider@test-isolation.test' },
  });
  await prisma.provider.delete({ where: { slug: 'test-other-provider' } }).catch(() => {});
  // Clean up any vehicles we created in the provider's account during tests
  if (createdVehicleId) {
    await prisma.vehicle.delete({ where: { id: createdVehicleId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

import { GET, POST } from './route';

// ---- (a) POST vehicle → 201, persists with provider's tenant ---------------
describe('POST /api/provider/vehicles', () => {
  it('(a) creates vehicle, returns 201, vehicle belongs to session provider', async () => {
    mockAuth(providerToken);

    const payload = {
      categoryId,
      branchId,
      name: 'Test Vehicle Alpha',
      make: 'TestMake',
      model: 'ModelX',
      year: 2024,
      transmission: 'automatic',
      fuelType: 'petrol',
      pricePerDay: 55,
      seats: 5,
    };
    const req = authedReq('POST', 'http://localhost/api/provider/vehicles', payload);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.providerId).toBe(providerProviderId);
    expect(body.name).toBe('Test Vehicle Alpha');
    expect(body.transmission).toBe('automatic');
    expect(body.fuelType).toBe('petrol');
    createdVehicleId = body.id;

    // Verify persisted in DB
    const dbVehicle = await prisma.vehicle.findUnique({ where: { id: body.id } });
    expect(dbVehicle).not.toBeNull();
    expect(dbVehicle!.providerId).toBe(providerProviderId);
    expect(dbVehicle!.transmission).toBe(transmissionToDb('automatic'));
    expect(dbVehicle!.fuelType).toBe(fuelTypeToDb('petrol'));
  });

  it('(e) forces session providerId — client cannot override to a foreign providerId', async () => {
    mockAuth(providerToken);

    const payload = {
      categoryId,
      name: 'Tenant Injection Attempt',
      transmission: 'automatic',
      fuelType: 'petrol',
      pricePerDay: 50,
      // Attempt to inject the OTHER provider's id — must be ignored
      providerId: otherProviderProviderId,
    };
    const req = authedReq('POST', 'http://localhost/api/provider/vehicles', payload);
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    // Must belong to session's own provider, not the injected one
    expect(body.providerId).toBe(providerProviderId);
    expect(body.providerId).not.toBe(otherProviderProviderId);
    // Clean up
    await prisma.vehicle.delete({ where: { id: body.id } }).catch(() => {});
  });

  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const req = authedReq('POST', 'http://localhost/api/provider/vehicles', {
      categoryId, name: 'X', transmission: 'automatic', fuelType: 'petrol', pricePerDay: 1,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid payload', async () => {
    mockAuth(providerToken);
    const req = authedReq('POST', 'http://localhost/api/provider/vehicles', { name: 'no required fields' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/provider/vehicles', () => {
  it('returns vehicles scoped to the session tenant', async () => {
    mockAuth(providerToken);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // All returned vehicles belong to this provider
    for (const v of body) {
      expect(v.providerId).toBe(providerProviderId);
    }
  });

  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
