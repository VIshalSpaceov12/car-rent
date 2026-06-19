import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';
import { signJwt } from '@/server/auth/jwt';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
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
let providerProviderId: string;
let otherProviderToken: string;
let otherProviderProviderId: string;
let vehicleId: string; // vehicle belonging to providerProviderId

beforeAll(async () => {
  const providerUser = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!providerUser) throw new Error('provider@demo.test not found — run npm run db:seed');
  providerToken = signJwt(providerUser.id);
  providerProviderId = providerUser.providerId!;

  const cat = await prisma.vehicleCategory.findFirst({ where: { providerId: providerProviderId } });
  if (!cat) throw new Error('No category found for provider — run npm run db:seed');

  // Create a vehicle to operate on
  const v = await prisma.vehicle.create({
    data: {
      name: 'ID Route Test Vehicle',
      providerId: providerProviderId,
      categoryId: cat.id,
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      status: 'ACTIVE',
      pricePerDay: 80,
    },
  });
  vehicleId = v.id;

  // Set up an isolated second provider + user
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('Password123!', 10);
  const otherProvider = await prisma.provider.upsert({
    where: { slug: 'test-other-vehicle-id' },
    update: {},
    create: {
      name: 'Other Vehicle ID Provider',
      slug: 'test-other-vehicle-id',
      colors: { primary: 'black' },
    },
  });
  otherProviderProviderId = otherProvider.id;

  const otherUser = await prisma.user.upsert({
    where: { email: 'other-vehicle-id@test-isolation.test' },
    update: {},
    create: {
      email: 'other-vehicle-id@test-isolation.test',
      name: 'Other Vehicle ID User',
      role: 'PROVIDER',
      passwordHash: hash,
      providerId: otherProvider.id,
    },
  });
  otherProviderToken = signJwt(otherUser.id);
});

afterAll(async () => {
  await prisma.vehicle.deleteMany({ where: { id: vehicleId } }).catch(() => {});
  await prisma.vehicle.deleteMany({ where: { providerId: otherProviderProviderId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: 'other-vehicle-id@test-isolation.test' } }).catch(() => {});
  await prisma.provider.delete({ where: { slug: 'test-other-vehicle-id' } }).catch(() => {});
  await prisma.$disconnect();
});

import { GET, PATCH, DELETE } from './route';

describe('GET /api/provider/vehicles/[id]', () => {
  it('returns vehicle for session tenant', async () => {
    mockAuth(providerToken);
    const req = new Request(`http://localhost/api/provider/vehicles/${vehicleId}`);
    const res = await GET(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(vehicleId);
    expect(body.providerId).toBe(providerProviderId);
  });

  it('returns 404 for cross-tenant access', async () => {
    mockAuth(otherProviderToken);
    const req = new Request(`http://localhost/api/provider/vehicles/${vehicleId}`);
    const res = await GET(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const req = new Request(`http://localhost/api/provider/vehicles/${vehicleId}`);
    const res = await GET(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/provider/vehicles/[id]', () => {
  it('(a) cross-tenant PATCH returns 404 and does not mutate the row', async () => {
    mockAuth(otherProviderToken);
    const req = new Request(`http://localhost/api/provider/vehicles/${vehicleId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Cross-Tenant Hack' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(404);

    // Confirm the vehicle is unchanged in the DB
    const dbVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    expect(dbVehicle?.name).toBe('ID Route Test Vehicle');
  });

  it('(c) successful PATCH updates only the session tenant\'s row', async () => {
    mockAuth(providerToken);
    const req = new Request(`http://localhost/api/provider/vehicles/${vehicleId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Vehicle Name' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Updated Vehicle Name');
    expect(body.providerId).toBe(providerProviderId);

    // Confirm updated in DB
    const dbVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    expect(dbVehicle?.name).toBe('Updated Vehicle Name');
  });

  it('returns 400 on invalid payload', async () => {
    mockAuth(providerToken);
    const req = new Request(`http://localhost/api/provider/vehicles/${vehicleId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transmission: 'invalid-value' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/provider/vehicles/[id]', () => {
  it('(a) cross-tenant DELETE returns 404 and does not delete the row', async () => {
    mockAuth(otherProviderToken);
    const req = new Request(`http://localhost/api/provider/vehicles/${vehicleId}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(404);

    // Row must still exist
    const dbVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    expect(dbVehicle).not.toBeNull();
  });

  it('(b) successful DELETE removes the row', async () => {
    mockAuth(providerToken);
    const req = new Request(`http://localhost/api/provider/vehicles/${vehicleId}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);

    // Row must be gone
    const dbVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    expect(dbVehicle).toBeNull();
    vehicleId = ''; // prevent afterAll double-delete
  });

  it('returns 404 for already-deleted vehicle', async () => {
    if (!vehicleId) return; // already deleted above
    mockAuth(providerToken);
    const req = new Request(`http://localhost/api/provider/vehicles/${vehicleId}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: vehicleId }) });
    expect(res.status).toBe(404);
  });
});
