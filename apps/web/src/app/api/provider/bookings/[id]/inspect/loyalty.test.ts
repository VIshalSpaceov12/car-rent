import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
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
let providerId: string;
let vehicleId: string;

// Dedicated isolated customer — never shared with other test files
let isolatedCustomerId: string;

// Per-test booking ids — reset in afterEach
let bookingId: string;
let bookingId2: string;

beforeAll(async () => {
  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);
  providerId = provider.providerId!;

  const vehicle = await prisma.vehicle.findFirst({
    where: { providerId, status: 'ACTIVE' },
  });
  if (!vehicle) throw new Error('No ACTIVE vehicle');
  vehicleId = vehicle.id;

  // Create a dedicated isolated customer for loyalty tests — separate from the seeded customer
  const hash = await (await import('bcrypt')).hash('Password123!', 10);
  let isolatedCustomer = await prisma.user.findUnique({ where: { email: 'loyalty-isolated@test.test' } });
  if (!isolatedCustomer) {
    isolatedCustomer = await prisma.user.create({
      data: {
        email: 'loyalty-isolated@test.test',
        name: 'Loyalty Isolated',
        role: 'CUSTOMER',
        passwordHash: hash,
        locale: 'EN',
      },
    });
  }
  isolatedCustomerId = isolatedCustomer.id;

  // Clean any leftover state for this isolated user from previous failed runs
  await prisma.loyaltyEntry.deleteMany({ where: { userId: isolatedCustomerId } });
  await prisma.loyaltyAccount.deleteMany({ where: { userId: isolatedCustomerId } });
});

afterEach(async () => {
  // Clean up per-test bookings and their loyalty entries to keep tests independent
  const ids = [bookingId, bookingId2].filter(Boolean);
  if (ids.length > 0) {
    await prisma.loyaltyEntry.deleteMany({ where: { bookingId: { in: ids } } });
    await prisma.returnInspection.deleteMany({ where: { bookingId: { in: ids } } });
    await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  }
  // Reset loyalty account to 0 for next test
  await prisma.loyaltyAccount.deleteMany({ where: { userId: isolatedCustomerId } });
  bookingId = '';
  bookingId2 = '';
});

afterAll(async () => {
  await prisma.$disconnect();
});

import { POST } from './route';

describe('Loyalty earn on inspect/complete', () => {
  it('awards points (floor(totalAmount)) when booking completes', async () => {
    // Create a fresh booking for this test
    const b1 = await prisma.booking.create({
      data: {
        providerId,
        customerId: isolatedCustomerId,
        vehicleId,
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

    mockAuth(providerToken);

    // Account doesn't exist yet; beforePoints delta is 0
    const res = await POST(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/inspect`, { condition: 'clean' }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(201);

    const afterAccount = await prisma.loyaltyAccount.findUnique({ where: { userId: isolatedCustomerId } });
    expect(afterAccount).not.toBeNull();
    // 230 total -> 230 points (asserts delta from 0)
    expect(afterAccount!.points).toBe(230);

    const entry = await prisma.loyaltyEntry.findFirst({ where: { bookingId } });
    expect(entry).not.toBeNull();
    expect(entry!.delta).toBe(230);
    expect(entry!.userId).toBe(isolatedCustomerId);
  });

  it('is idempotent: calling inspect again does not double-award (booking already completed)', async () => {
    // Create and immediately complete a booking so we can try inspecting it twice
    const b1 = await prisma.booking.create({
      data: {
        providerId,
        customerId: isolatedCustomerId,
        vehicleId,
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
    bookingId = b1.id;

    mockAuth(providerToken);

    // First call — should succeed
    const res1 = await POST(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/inspect`, { condition: 'clean' }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res1.status).toBe(201);

    const pointsAfterFirst = (await prisma.loyaltyAccount.findUnique({ where: { userId: isolatedCustomerId } }))?.points ?? 0;

    // Second call — should fail with 422 invalid_status (already completed)
    const res2 = await POST(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/inspect`, { condition: 'clean' }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res2.status).toBe(422);

    const pointsAfterSecond = (await prisma.loyaltyAccount.findUnique({ where: { userId: isolatedCustomerId } }))?.points ?? 0;
    expect(pointsAfterSecond).toBe(pointsAfterFirst); // unchanged
  });
});
