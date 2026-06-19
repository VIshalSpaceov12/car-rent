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

let customerToken: string;
let providerToken: string;
let providerBToken: string;
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

  // Booking owned by the seeded customer under provider-A tenant
  const booking = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2025-08-10'),
      endDate: new Date('2025-08-13'),
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

  // Create a second "other" customer to test ownership isolation
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('Password123!', 10);
  const otherCustomer = await prisma.user.upsert({
    where: { email: 'other-customer@booking-id-get-test.test' },
    update: {},
    create: {
      email: 'other-customer@booking-id-get-test.test',
      name: 'Other Customer GET',
      role: 'CUSTOMER',
      passwordHash: hash,
    },
  });
  const otherBooking = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: otherCustomer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2025-09-10'),
      endDate: new Date('2025-09-13'),
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

  // Create a provider-B (separate tenant) to test cross-tenant isolation
  const category = await prisma.vehicleCategory.findFirst({ where: { providerId: provider.providerId! } });
  if (!category) throw new Error('No vehicle category for provider');

  const providerBEntity = await prisma.provider.upsert({
    where: { slug: 'provider-b-get-test' },
    update: {},
    create: {
      name: 'Provider B GET Test',
      slug: 'provider-b-get-test',
      colors: {},
    },
  });

  const providerBUser = await prisma.user.upsert({
    where: { email: 'provider-b@booking-id-get-test.test' },
    update: {},
    create: {
      email: 'provider-b@booking-id-get-test.test',
      name: 'Provider B User',
      role: 'PROVIDER',
      passwordHash: hash,
      providerId: providerBEntity.id,
    },
  });
  providerBToken = signJwt(providerBUser.id);
});

afterAll(async () => {
  await prisma.booking.deleteMany({
    where: { id: { in: [bookingId, otherCustomerBookingId].filter(Boolean) } },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          'other-customer@booking-id-get-test.test',
          'provider-b@booking-id-get-test.test',
        ],
      },
    },
  });
  await prisma.provider.deleteMany({ where: { slug: 'provider-b-get-test' } });
  await prisma.$disconnect();
});

import { GET } from './route';

function getReq(id: string): Request {
  return new Request(`http://localhost/api/bookings/${id}`, { method: 'GET' });
}

describe('GET /api/bookings/[id]', () => {
  it('customer who owns the booking receives 200 with booking data', async () => {
    mockAuth(customerToken);
    const res = await GET(getReq(bookingId), { params: Promise.resolve({ id: bookingId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(bookingId);
    expect(body.status).toBe('reserved');
  });

  it('customer trying to access another customer booking receives 403', async () => {
    mockAuth(customerToken);
    const res = await GET(getReq(otherCustomerBookingId), { params: Promise.resolve({ id: otherCustomerBookingId }) });
    expect(res.status).toBe(403);
  });

  it('provider in the same tenant receives 200 with booking data', async () => {
    mockAuth(providerToken);
    const res = await GET(getReq(bookingId), { params: Promise.resolve({ id: bookingId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(bookingId);
  });

  it('provider from a different tenant (cross-tenant) receives 403', async () => {
    mockAuth(providerBToken);
    const res = await GET(getReq(bookingId), { params: Promise.resolve({ id: bookingId }) });
    expect(res.status).toBe(403);
  });

  it('unauthenticated request receives 401', async () => {
    mockNoAuth();
    const res = await GET(getReq(bookingId), { params: Promise.resolve({ id: bookingId }) });
    expect(res.status).toBe(401);
  });

  it('non-existent booking id receives 404', async () => {
    mockAuth(customerToken);
    const res = await GET(getReq('nonexistent-booking-id'), { params: Promise.resolve({ id: 'nonexistent-booking-id' }) });
    expect(res.status).toBe(404);
  });
});
