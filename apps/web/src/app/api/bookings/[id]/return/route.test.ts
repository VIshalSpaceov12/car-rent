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
function postReq(url: string) {
  return new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' } });
}

let providerToken: string;
let customerToken: string;
let otherCustomerToken: string;
let bookingId: string;

beforeAll(async () => {
  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);

  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  const hash = await (await import('bcrypt')).hash('Password123!', 10);
  const otherCust = await prisma.user.upsert({
    where: { email: 'other-return@test.test' },
    update: {},
    create: { email: 'other-return@test.test', name: 'Other', role: 'CUSTOMER', passwordHash: hash },
  });
  otherCustomerToken = signJwt(otherCust.id);

  const vehicle = await prisma.vehicle.findFirst({
    where: { providerId: provider.providerId!, status: 'ACTIVE' },
  });
  if (!vehicle) throw new Error('No ACTIVE vehicle');

  const booking = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-03'),
      plan: 'DAILY',
      status: 'PICKED_UP',
      baseAmount: 200,
      taxAmount: 21,
      serviceCharge: 10,
      totalAmount: 231,
      currency: 'USD',
    },
  });
  bookingId = booking.id;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.user.deleteMany({ where: { email: 'other-return@test.test' } });
  await prisma.$disconnect();
});

import { POST } from './route';

describe('POST /api/bookings/[id]/return', () => {
  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingId}/return`),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when customer does not own booking', async () => {
    mockAuth(otherCustomerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingId}/return`),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when provider tries to use the customer return endpoint', async () => {
    mockAuth(providerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingId}/return`),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(403);
  });

  it('transitions booking to returned successfully', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingId}/return`),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('returned');

    const db = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(db!.status).toBe('RETURNED');
  });

  it('returns 422 on double-return (already returned)', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingId}/return`),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(422);
  });
});
