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
function postReq(url: string, body?: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

let customerToken: string;
let providerToken: string;
let sourceBookingId: string;
let reservedBookingId: string;
const createdBookingIds: string[] = [];

beforeAll(async () => {
  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);

  const vehicle = await prisma.vehicle.findFirst({
    where: { providerId: provider.providerId!, status: 'ACTIVE' },
  });
  if (!vehicle) throw new Error('No ACTIVE vehicle seeded');

  // Create a completed booking to rebook from
  const booking = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-04'),
      plan: 'DAILY',
      status: 'COMPLETED',
      baseAmount: 300,
      taxAmount: 30,
      serviceCharge: 15,
      totalAmount: 345,
      currency: 'USD',
    },
  });
  sourceBookingId = booking.id;

  // Create a RESERVED booking to test status guard
  const reservedBooking = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2028-01-01'),
      endDate: new Date('2028-01-04'),
      plan: 'DAILY',
      status: 'RESERVED',
      baseAmount: 300,
      taxAmount: 30,
      serviceCharge: 15,
      totalAmount: 345,
      currency: 'USD',
    },
  });
  reservedBookingId = reservedBooking.id;
});

afterAll(async () => {
  for (const id of createdBookingIds) {
    await prisma.booking.delete({ where: { id } }).catch(() => {});
  }
  await prisma.booking.delete({ where: { id: sourceBookingId } }).catch(() => {});
  await prisma.booking.delete({ where: { id: reservedBookingId } }).catch(() => {});
  await prisma.$disconnect();
});

import { POST } from './route';

describe('POST /api/bookings/[id]/rebook', () => {
  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await POST(
      postReq(`http://localhost/api/bookings/${sourceBookingId}/rebook`, {}),
      { params: Promise.resolve({ id: sourceBookingId }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when provider tries to rebook', async () => {
    mockAuth(providerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${sourceBookingId}/rebook`, {}),
      { params: Promise.resolve({ id: sourceBookingId }) }
    );
    expect(res.status).toBe(403);
  });

  it('creates a new RESERVED booking copying vehicle/plan from source', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${sourceBookingId}/rebook`, {
        startDate: '2027-01-01',
        endDate: '2027-01-04',
      }),
      { params: Promise.resolve({ id: sourceBookingId }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    createdBookingIds.push(body.id);

    expect(body.status).toBe('reserved');
    expect(body.totalAmount).toBeGreaterThan(0);

    // Verify in DB
    const db = await prisma.booking.findUnique({ where: { id: body.id } });
    expect(db).not.toBeNull();
    expect(db!.status).toBe('RESERVED');
    expect(db!.plan).toBe('DAILY'); // Copied from source

    const sourceDb = await prisma.booking.findUnique({ where: { id: sourceBookingId } });
    expect(db!.vehicleId).toBe(sourceDb!.vehicleId);
  });

  it('returns 422 when source booking is not completed (RESERVED)', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${reservedBookingId}/rebook`, {
        startDate: '2029-01-01',
        endDate: '2029-01-04',
      }),
      { params: Promise.resolve({ id: reservedBookingId }) }
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('not_completed');
  });

  it('returns 404 for non-owned booking', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/nonexistent-id/rebook`, {}),
      { params: Promise.resolve({ id: 'nonexistent-id' }) }
    );
    expect(res.status).toBe(404);
  });
});
