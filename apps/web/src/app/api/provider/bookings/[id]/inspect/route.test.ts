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

let providerToken: string;
let customerToken: string;
let bookingId: string;

beforeAll(async () => {
  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);

  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  const vehicle = await prisma.vehicle.findFirst({
    where: { providerId: provider.providerId!, status: 'ACTIVE' },
  });
  if (!vehicle) throw new Error('No ACTIVE vehicle');

  const booking = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-03'),
      plan: 'DAILY',
      status: 'RETURNED',
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
  await prisma.returnInspection.deleteMany({ where: { bookingId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.$disconnect();
});

import { POST } from './route';

describe('POST /api/provider/bookings/[id]/inspect', () => {
  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await POST(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/inspect`, { condition: 'clean' }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when customer tries to inspect', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/inspect`, { condition: 'clean' }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid condition', async () => {
    mockAuth(providerToken);
    const res = await POST(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/inspect`, { condition: 'totalled' }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(400);
  });

  it('returns 422 if booking is not in returned status', async () => {
    // Create a booking in PICKED_UP state to test wrong-status guard
    const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
    const vehicle = await prisma.vehicle.findFirst({ where: { providerId: provider!.providerId!, status: 'ACTIVE' } });
    const wrongStatusBooking = await prisma.booking.create({
      data: {
        providerId: provider!.providerId!,
        customerId: (await prisma.user.findUnique({ where: { email: 'customer@demo.test' } }))!.id,
        vehicleId: vehicle!.id,
        startDate: new Date('2026-05-01'),
        endDate: new Date('2026-05-03'),
        plan: 'DAILY',
        status: 'PICKED_UP',
        baseAmount: 200, taxAmount: 21, serviceCharge: 10, totalAmount: 231, currency: 'USD',
      },
    });

    mockAuth(providerToken);
    const res = await POST(
      postReq(`http://localhost/api/provider/bookings/${wrongStatusBooking.id}/inspect`, { condition: 'clean' }),
      { params: Promise.resolve({ id: wrongStatusBooking.id }) }
    );
    expect(res.status).toBe(422);

    await prisma.booking.delete({ where: { id: wrongStatusBooking.id } });
  });

  it('records inspection and transitions to completed', async () => {
    mockAuth(providerToken);
    const res = await POST(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/inspect`, {
        condition: 'minor-damage',
        notes: 'Small scratch on rear bumper',
      }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.inspection.condition).toBe('minor-damage');
    expect(body.inspection.notes).toBe('Small scratch on rear bumper');
    expect(body.booking.status).toBe('completed');

    const db = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(db!.status).toBe('COMPLETED');
  });
});
