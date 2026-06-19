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

function refundReq(id: string): Request {
  return new Request(`http://localhost/api/payments/${id}/refund`, {
    method: 'POST',
  });
}

let providerToken: string;
let customerToken: string;
let providerBToken: string;
let providerId: string;
let vehicleId: string;

async function createPaidPayment(status: 'PAID' | 'PENDING' | 'FAILED', bookingStatus: 'RESERVED' | 'CONFIRMED' | 'PICKED_UP' = 'CONFIRMED') {
  const booking = await prisma.booking.create({
    data: {
      providerId,
      customerId: (await prisma.user.findUnique({ where: { email: 'customer@demo.test' } }))!.id,
      vehicleId,
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-05'),
      plan: 'DAILY',
      status: bookingStatus,
      baseAmount: 400,
      taxAmount: 42,
      serviceCharge: 20,
      totalAmount: 462,
      currency: 'USD',
    },
  });
  const payment = await prisma.payment.create({
    data: {
      providerId,
      bookingId: booking.id,
      amount: booking.totalAmount,
      currency: booking.currency,
      method: 'CARD',
      status,
    },
  });
  return { booking, payment };
}

beforeAll(async () => {
  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);
  providerId = provider.providerId!;

  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  const vehicle = await prisma.vehicle.findFirst({
    where: { providerId, status: 'ACTIVE' },
  });
  if (!vehicle) throw new Error('No ACTIVE vehicle for provider');
  vehicleId = vehicle.id;

  // Create provider-B for cross-tenant test
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('Password123!', 10);

  const providerBEntity = await prisma.provider.upsert({
    where: { slug: 'provider-b-refund-test' },
    update: {},
    create: { name: 'Provider B Refund Test', slug: 'provider-b-refund-test', colors: {} },
  });

  const providerBUser = await prisma.user.upsert({
    where: { email: 'provider-b@refund-test.test' },
    update: {},
    create: {
      email: 'provider-b@refund-test.test',
      name: 'Provider B Refund',
      role: 'PROVIDER',
      passwordHash: hash,
      providerId: providerBEntity.id,
    },
  });
  providerBToken = signJwt(providerBUser.id);
});

afterAll(async () => {
  await prisma.payment.deleteMany({
    where: { booking: { startDate: new Date('2026-10-01'), providerId } },
  });
  await prisma.booking.deleteMany({
    where: { startDate: new Date('2026-10-01'), providerId },
  });
  await prisma.user.deleteMany({ where: { email: 'provider-b@refund-test.test' } });
  await prisma.provider.deleteMany({ where: { slug: 'provider-b-refund-test' } });
  await prisma.$disconnect();
});

import { POST } from './route';

describe('POST /api/payments/[id]/refund', () => {
  it('provider can refund a paid payment → status becomes refunded', async () => {
    mockAuth(providerToken);
    const { payment } = await createPaidPayment('PAID', 'CONFIRMED');

    const res = await POST(refundReq(payment.id), {
      params: Promise.resolve({ id: payment.id }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('refunded');

    const dbPay = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(dbPay!.status).toBe('REFUNDED');
  });

  it('refunding a paid payment on a pre-pickup booking also cancels the booking', async () => {
    mockAuth(providerToken);
    const { payment, booking } = await createPaidPayment('PAID', 'CONFIRMED');

    await POST(refundReq(payment.id), { params: Promise.resolve({ id: payment.id }) });

    const dbBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(dbBooking!.status).toBe('CANCELLED');
  });

  it('refunding a paid payment on a picked-up booking does NOT cancel the booking', async () => {
    mockAuth(providerToken);
    const { payment, booking } = await createPaidPayment('PAID', 'PICKED_UP');

    await POST(refundReq(payment.id), { params: Promise.resolve({ id: payment.id }) });

    const dbBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(dbBooking!.status).toBe('PICKED_UP');
  });

  it('cannot refund a pending payment → 422', async () => {
    mockAuth(providerToken);
    const { payment } = await createPaidPayment('PENDING', 'RESERVED');

    const res = await POST(refundReq(payment.id), {
      params: Promise.resolve({ id: payment.id }),
    });
    expect(res.status).toBe(422);
  });

  it('cannot refund a failed payment → 422', async () => {
    mockAuth(providerToken);
    const { payment } = await createPaidPayment('FAILED', 'RESERVED');

    const res = await POST(refundReq(payment.id), {
      params: Promise.resolve({ id: payment.id }),
    });
    expect(res.status).toBe(422);
  });

  it('customer cannot refund → 403', async () => {
    mockAuth(customerToken);
    const { payment } = await createPaidPayment('PAID');

    const res = await POST(refundReq(payment.id), {
      params: Promise.resolve({ id: payment.id }),
    });
    expect(res.status).toBe(403);
  });

  it('provider-B cannot refund a payment belonging to provider-A → 403', async () => {
    mockAuth(providerBToken);
    const { payment } = await createPaidPayment('PAID');

    const res = await POST(refundReq(payment.id), {
      params: Promise.resolve({ id: payment.id }),
    });
    expect(res.status).toBe(403);
  });

  it('unauthenticated → 401', async () => {
    mockNoAuth();
    const { payment } = await createPaidPayment('PAID');

    const res = await POST(refundReq(payment.id), {
      params: Promise.resolve({ id: payment.id }),
    });
    expect(res.status).toBe(401);
  });

  it('non-existent payment → 404', async () => {
    mockAuth(providerToken);
    const res = await POST(refundReq('nonexistent-id'), {
      params: Promise.resolve({ id: 'nonexistent-id' }),
    });
    expect(res.status).toBe(404);
  });
});

// Also test provider payments list
import { GET as getProviderPayments } from '@/app/api/provider/payments/route';

describe('GET /api/provider/payments', () => {
  it('provider gets their own payments', async () => {
    mockAuth(providerToken);
    const res = await getProviderPayments();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // All payments should belong to this provider's tenant
    for (const p of body) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('bookingId');
      expect(p).toHaveProperty('amount');
      expect(p).toHaveProperty('status');
      expect(p).toHaveProperty('method');
    }
  });

  it('customer cannot access provider payments list → 403', async () => {
    mockAuth(customerToken);
    const res = await getProviderPayments();
    expect(res.status).toBe(403);
  });

  it('unauthenticated → 401', async () => {
    mockNoAuth();
    const res = await getProviderPayments();
    expect(res.status).toBe(401);
  });
});
