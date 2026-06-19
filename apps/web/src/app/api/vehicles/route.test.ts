import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';

// No next/headers mock needed for browse routes (unauthenticated)
let testVehicleId: string;
let testCategoryId: string;

beforeAll(async () => {
  // Resolve demo provider
  const provider = await prisma.provider.findFirst({ where: { slug: 'drivehub' } });
  if (!provider) throw new Error('DriveHub provider not seeded');

  const cat = await prisma.vehicleCategory.findFirst({ where: { providerId: provider.id } });
  if (!cat) throw new Error('No category seeded');
  testCategoryId = cat.id;

  // Find an active vehicle to test detail
  const v = await prisma.vehicle.findFirst({
    where: { providerId: provider.id, status: 'ACTIVE' },
  });
  if (!v) throw new Error('No active vehicles seeded');
  testVehicleId = v.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

import { GET as listVehicles } from './route';
import { GET as getVehicle } from './[id]/route';

// ---- (b) new vehicle appears in GET /api/vehicles browse -----------------
describe('GET /api/vehicles', () => {
  it('(b) returns active vehicles list including seeded vehicles', async () => {
    const req = new Request('http://localhost/api/vehicles');
    const res = await listVehicles(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    // All status=active
    for (const v of body) {
      expect(v.status).toBe('active');
      expect(v.categoryName).toBeTruthy();
    }
    // The test vehicle is included
    const found = body.find((v: { id: string }) => v.id === testVehicleId);
    expect(found).toBeDefined();
  });

  // ---- (c) filter by categoryId narrows results ---------------------------
  it('(c) filter by categoryId narrows results', async () => {
    const req = new Request(`http://localhost/api/vehicles?categoryId=${testCategoryId}`);
    const res = await listVehicles(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    for (const v of body) {
      expect(v.categoryId).toBe(testCategoryId);
    }
  });

  it('filter by transmission=automatic', async () => {
    const req = new Request('http://localhost/api/vehicles?transmission=automatic');
    const res = await listVehicles(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const v of body) {
      expect(v.transmission).toBe('automatic');
    }
  });

  it('filter by price range', async () => {
    const req = new Request('http://localhost/api/vehicles?minPrice=40&maxPrice=100');
    const res = await listVehicles(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const v of body) {
      expect(v.pricePerDay).toBeGreaterThanOrEqual(40);
      expect(v.pricePerDay).toBeLessThanOrEqual(100);
    }
  });

  it('filter by q (name search) returns matching vehicles', async () => {
    const req = new Request('http://localhost/api/vehicles?q=Toyota');
    const res = await listVehicles(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const v of body) {
      expect(v.name.toLowerCase()).toContain('toyota');
    }
  });
});

// ---- (d) GET /api/vehicles/[id] returns detail ----------------------------
describe('GET /api/vehicles/[id]', () => {
  it('(d) returns detail for an active vehicle', async () => {
    const req = new Request(`http://localhost/api/vehicles/${testVehicleId}`);
    const res = await getVehicle(req, { params: Promise.resolve({ id: testVehicleId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(testVehicleId);
    expect(body.status).toBe('active');
    expect(body.categoryName).toBeTruthy();
    expect(body.pricePerDay).toBeGreaterThan(0);
    // Wire format enums are lowercase/kebab
    expect(['automatic', 'manual']).toContain(body.transmission);
    expect(['petrol', 'diesel', 'electric', 'hybrid']).toContain(body.fuelType);
  });

  it('returns 404 for unknown id', async () => {
    const req = new Request('http://localhost/api/vehicles/nonexistent-id');
    const res = await getVehicle(req, { params: Promise.resolve({ id: 'nonexistent-id' }) });
    expect(res.status).toBe(404);
  });
});
