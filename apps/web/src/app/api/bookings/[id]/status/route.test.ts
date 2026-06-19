import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
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
let providerToken: string;
let bookingId: string;
let otherCustomerBookingId: string;

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
  if (!vehicle) throw new Error('No ACTIVE vehicle for provider');

  // Create a booking in RESERVED state for the customer
  const booking = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2025-08-01'),
      endDate: new Date('2025-08-04'),
      plan: 'DAILY',
      status: 'RESERVED',
      baseAmount: 300,
      taxAmount: 31.5,
      serviceCharge: 15,
      totalAmount: 346.5,
      currency: 'USD',
    },
  });
  bookingId = booking.id;

  // Create another booking owned by a different "other" customer for isolation test
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('Password123!', 10);
  const otherCustomer = await prisma.user.upsert({
    where: { email: 'other-customer@booking-status-test.test' },
    update: {},
    create: {
      email: 'other-customer@booking-status-test.test',
      name: 'Other Customer',
      role: 'CUSTOMER',
      passwordHash: hash,
    },
  });
  const otherBooking = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: otherCustomer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-09-04'),
      plan: 'DAILY',
      status: 'RESERVED',
      baseAmount: 300,
      taxAmount: 31.5,
      serviceCharge: 15,
      totalAmount: 346.5,
      currency: 'USD',
    },
  });
  otherCustomerBookingId = otherBooking.id;
});

afterAll(async () => {
  await prisma.booking.deleteMany({
    where: { id: { in: [bookingId, otherCustomerBookingId].filter(Boolean) } },
  });
  await prisma.user.deleteMany({
    where: { email: 'other-customer@booking-status-test.test' },
  });
  await prisma.$disconnect();
});

import { PATCH } from './route';

function patchReq(id: string, status: string, token?: string) {
  return authedReq('PATCH', `http://localhost/api/bookings/${id}/status`, { status }, token);
}

describe('PATCH /api/bookings/[id]/status', () => {
  it('provider can legally advance reserved->confirmed', async () => {
    mockAuth(providerToken);
    const res = await PATCH(patchReq(bookingId, 'confirmed'), { params: Promise.resolve({ id: bookingId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('confirmed');

    // Verify in DB
    const db = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(db!.status).toBe('CONFIRMED');
  });

  it('provider can advance confirmed->vehicle-prepared', async () => {
    mockAuth(providerToken);
    const res = await PATCH(patchReq(bookingId, 'vehicle-prepared'), { params: Promise.resolve({ id: bookingId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('vehicle-prepared');
  });

  it('illegal transition (vehicle-prepared->completed) returns 422', async () => {
    mockAuth(providerToken);
    const res = await PATCH(patchReq(bookingId, 'completed'), { params: Promise.resolve({ id: bookingId }) });
    expect(res.status).toBe(422);
  });

  it('customer cannot drive a provider-only transition (vehicle-prepared->picked-up)', async () => {
    mockAuth(customerToken);
    const res = await PATCH(patchReq(bookingId, 'picked-up'), { params: Promise.resolve({ id: bookingId }) });
    expect(res.status).toBe(422);
  });

  it('customer cannot access another customer booking (tenant ownership enforced)', async () => {
    mockAuth(customerToken);
    const res = await PATCH(patchReq(otherCustomerBookingId, 'cancelled'), { params: Promise.resolve({ id: otherCustomerBookingId }) });
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await PATCH(patchReq(bookingId, 'confirmed'), { params: Promise.resolve({ id: bookingId }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid status value', async () => {
    mockAuth(providerToken);
    const res = await PATCH(patchReq(bookingId, 'invalid-status'), { params: Promise.resolve({ id: bookingId }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent booking', async () => {
    mockAuth(providerToken);
    const res = await PATCH(patchReq('nonexistent-id', 'confirmed'), { params: Promise.resolve({ id: 'nonexistent-id' }) });
    expect(res.status).toBe(404);
  });
});
