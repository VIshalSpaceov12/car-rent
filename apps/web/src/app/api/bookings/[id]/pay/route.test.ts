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

function payReq(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/bookings/${id}/pay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let customerToken: string;
let providerToken: string;
let otherCustomerToken: string;
let providerId: string;
let vehicleId: string;

async function createReservedBooking(customerId: string): Promise<string> {
  const booking = await prisma.booking.create({
    data: {
      providerId,
      customerId,
      vehicleId,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-05'),
      plan: 'DAILY',
      status: 'RESERVED',
      baseAmount: 400,
      taxAmount: 42,
      serviceCharge: 20,
      totalAmount: 462,
      currency: 'USD',
    },
  });
  return booking.id;
}

beforeAll(async () => {
  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);
  providerId = provider.providerId!;

  const vehicle = await prisma.vehicle.findFirst({
    where: { providerId, status: 'ACTIVE' },
  });
  if (!vehicle) throw new Error('No ACTIVE vehicle for provider');
  vehicleId = vehicle.id;

  // Create a second customer for isolation tests
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('Password123!', 10);
  const otherCustomer = await prisma.user.upsert({
    where: { email: 'other-customer@pay-test.test' },
    update: {},
    create: {
      email: 'other-customer@pay-test.test',
      name: 'Other Customer Pay Test',
      role: 'CUSTOMER',
      passwordHash: hash,
    },
  });
  otherCustomerToken = signJwt(otherCustomer.id);
});

afterAll(async () => {
  // Clean up payments linked to pay-test bookings before deleting bookings
  await prisma.payment.deleteMany({
    where: {
      booking: {
        AND: [
          { providerId },
          { startDate: new Date('2026-09-01') },
        ],
      },
    },
  });
  await prisma.booking.deleteMany({
    where: {
      AND: [{ providerId }, { startDate: new Date('2026-09-01') }],
    },
  });
  await prisma.user.deleteMany({
    where: { email: 'other-customer@pay-test.test' },
  });
  await prisma.$disconnect();
});

import { POST } from './route';

describe('POST /api/bookings/[id]/pay', () => {
  it('mock-card success → Payment paid + booking confirmed', async () => {
    mockAuth(customerToken);
    const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
    const bookingId = await createReservedBooking(customer!.id);

    const res = await POST(payReq(bookingId, { method: 'card', cardOutcome: 'success' }), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.payment.status).toBe('paid');
    expect(body.payment.method).toBe('card');
    expect(body.booking.status).toBe('confirmed');
    expect(body.booking.payment).toBeDefined();
    expect(body.booking.payment.status).toBe('paid');

    // Verify no card data was persisted
    const dbPayment = await prisma.payment.findUnique({ where: { id: body.payment.id } });
    expect(dbPayment).toBeTruthy();
    // Only method/status/amount/currency should be stored (no card fields on Payment model)
    expect(Object.keys(dbPayment!)).not.toContain('cardNumber');
    expect(Object.keys(dbPayment!)).not.toContain('cvv');
  });

  it('mock-card fail → Payment failed + booking stays reserved', async () => {
    mockAuth(customerToken);
    const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
    const bookingId = await createReservedBooking(customer!.id);

    const res = await POST(payReq(bookingId, { method: 'card', cardOutcome: 'fail' }), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.payment.status).toBe('failed');
    expect(body.booking.status).toBe('reserved');
  });

  it('cash-on-delivery → payment pending + booking confirmed', async () => {
    mockAuth(customerToken);
    const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
    const bookingId = await createReservedBooking(customer!.id);

    const res = await POST(payReq(bookingId, { method: 'cash-on-delivery' }), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.payment.status).toBe('pending');
    expect(body.payment.method).toBe('cash-on-delivery');
    expect(body.booking.status).toBe('confirmed');
  });

  it('card fail then card success retry → payment updated to paid + booking confirmed (not 500)', async () => {
    mockAuth(customerToken);
    const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
    const bookingId = await createReservedBooking(customer!.id);

    // First attempt: card fail — should return 201 with failed payment
    const res1 = await POST(payReq(bookingId, { method: 'card', cardOutcome: 'fail' }), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(res1.status).toBe(201);
    const body1 = await res1.json();
    expect(body1.payment.status).toBe('failed');
    expect(body1.booking.status).toBe('reserved');

    // Second attempt: card success — must NOT crash (was P2002 → 500), should succeed
    mockAuth(customerToken);
    const res2 = await POST(payReq(bookingId, { method: 'card', cardOutcome: 'success' }), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(res2.status).toBe(201);
    const body2 = await res2.json();
    expect(body2.payment.status).toBe('paid');
    expect(body2.booking.status).toBe('confirmed');
    // Same payment row should be reused (upsert), not a new one
    expect(body2.payment.id).toBe(body1.payment.id);
  });

  it('double-pay on already-confirmed booking → 409', async () => {
    mockAuth(customerToken);
    const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
    const bookingId = await createReservedBooking(customer!.id);

    // First payment succeeds
    const res1 = await POST(payReq(bookingId, { method: 'card', cardOutcome: 'success' }), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(res1.status).toBe(201);

    // Second payment should be 409
    const res2 = await POST(payReq(bookingId, { method: 'card', cardOutcome: 'success' }), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(res2.status).toBe(409);
  });

  it('unauthenticated → 401', async () => {
    mockNoAuth();
    const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
    const bookingId = await createReservedBooking(customer!.id);

    const res = await POST(payReq(bookingId, { method: 'card' }), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(res.status).toBe(401);

    // Clean up since payment wasn't made
    await prisma.booking.delete({ where: { id: bookingId } });
  });

  it('provider trying to pay → 403', async () => {
    mockAuth(providerToken);
    const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
    const bookingId = await createReservedBooking(customer!.id);

    const res = await POST(payReq(bookingId, { method: 'card' }), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(res.status).toBe(403);

    // Clean up
    await prisma.booking.delete({ where: { id: bookingId } });
  });

  it('customer cannot pay another customer booking → 403', async () => {
    mockAuth(otherCustomerToken);
    const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
    const bookingId = await createReservedBooking(customer!.id);

    const res = await POST(payReq(bookingId, { method: 'card' }), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(res.status).toBe(403);

    // Clean up
    await prisma.booking.delete({ where: { id: bookingId } });
  });

  it('non-existent booking → 404', async () => {
    mockAuth(customerToken);
    const res = await POST(payReq('nonexistent-id', { method: 'card' }), {
      params: Promise.resolve({ id: 'nonexistent-id' }),
    });
    expect(res.status).toBe(404);
  });

  it('invalid method → 400', async () => {
    mockAuth(customerToken);
    const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
    const bookingId = await createReservedBooking(customer!.id);

    const res = await POST(payReq(bookingId, { method: 'bitcoin' }), {
      params: Promise.resolve({ id: bookingId }),
    });
    expect(res.status).toBe(400);

    // Clean up
    await prisma.booking.delete({ where: { id: bookingId } });
  });
});
