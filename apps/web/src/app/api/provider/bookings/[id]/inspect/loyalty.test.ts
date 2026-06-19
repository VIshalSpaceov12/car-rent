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

function postReq(url: string, body?: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

let providerToken: string;
let customerId: string;
let bookingId: string;
let bookingId2: string;

beforeAll(async () => {
  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);

  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerId = customer.id;

  // Clean any existing loyalty entries for this customer to avoid test pollution
  await prisma.loyaltyEntry.deleteMany({ where: { userId: customerId, reason: { contains: 'loyalty-test' } } });

  const vehicle = await prisma.vehicle.findFirst({
    where: { providerId: provider.providerId!, status: 'ACTIVE' },
  });
  if (!vehicle) throw new Error('No ACTIVE vehicle');

  const b1 = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-03'),
      plan: 'DAILY',
      status: 'RETURNED',
      baseAmount: 200,
      taxAmount: 20,
      serviceCharge: 10,
      totalAmount: 230,
      currency: 'USD',
    },
  });
  bookingId = b1.id;

  const b2 = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-03'),
      plan: 'DAILY',
      status: 'RETURNED',
      baseAmount: 200,
      taxAmount: 20,
      serviceCharge: 10,
      totalAmount: 230,
      currency: 'USD',
    },
  });
  bookingId2 = b2.id;
});

afterAll(async () => {
  await prisma.loyaltyEntry.deleteMany({ where: { bookingId: { in: [bookingId, bookingId2] } } });
  await prisma.returnInspection.deleteMany({ where: { bookingId: { in: [bookingId, bookingId2] } } });
  await prisma.booking.deleteMany({ where: { id: { in: [bookingId, bookingId2] } } });
  await prisma.$disconnect();
});

import { POST } from './route';

describe('Loyalty earn on inspect/complete', () => {
  it('awards points (floor(totalAmount)) when booking completes', async () => {
    mockAuth(providerToken);

    const beforeAccount = await prisma.loyaltyAccount.findUnique({ where: { userId: customerId } });
    const beforePoints = beforeAccount?.points ?? 0;

    const res = await POST(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/inspect`, { condition: 'clean' }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(201);

    const afterAccount = await prisma.loyaltyAccount.findUnique({ where: { userId: customerId } });
    expect(afterAccount).not.toBeNull();
    // 230 total -> 230 points
    expect(afterAccount!.points).toBe(beforePoints + 230);

    const entry = await prisma.loyaltyEntry.findFirst({ where: { bookingId } });
    expect(entry).not.toBeNull();
    expect(entry!.delta).toBe(230);
    expect(entry!.userId).toBe(customerId);
  });

  it('is idempotent: calling inspect again does not double-award (booking already completed)', async () => {
    mockAuth(providerToken);

    const beforeAccount = await prisma.loyaltyAccount.findUnique({ where: { userId: customerId } });
    const pointsBefore = beforeAccount?.points ?? 0;

    // Attempt to inspect again — should fail with 422 invalid_status (already completed)
    const res = await POST(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/inspect`, { condition: 'clean' }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(422); // already completed

    const afterAccount = await prisma.loyaltyAccount.findUnique({ where: { userId: customerId } });
    expect(afterAccount!.points).toBe(pointsBefore); // unchanged
  });
});
