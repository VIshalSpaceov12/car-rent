import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';
import { signJwt } from '@/server/auth/jwt';
import bcrypt from 'bcrypt';

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
let otherCustomerToken: string;
let bookingId: string;
let otherBookingId: string;
let correctCode: string;

beforeAll(async () => {
  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');

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
      startDate: new Date('2025-11-01'),
      endDate: new Date('2025-11-03'),
      plan: 'DAILY',
      status: 'VEHICLE_PREPARED',
      baseAmount: 200,
      taxAmount: 21,
      serviceCharge: 10,
      totalAmount: 231,
      currency: 'USD',
    },
  });
  bookingId = booking.id;

  // Seed OTP with known code
  correctCode = '123456';
  const hash = await bcrypt.hash(correctCode, 10);
  await prisma.otp.create({
    data: {
      bookingId: booking.id,
      vehicleId: vehicle.id,
      providerId: provider.providerId!,
      codeHash: hash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      attempts: 0,
      consumedAt: null,
    },
  });

  // Create a second customer + booking for isolation tests
  const otherHash = await bcrypt.hash('Password123!', 10);
  const otherCustomer = await prisma.user.upsert({
    where: { email: 'other-otp-verify@test.test' },
    update: {},
    create: {
      email: 'other-otp-verify@test.test',
      name: 'Other',
      role: 'CUSTOMER',
      passwordHash: otherHash,
    },
  });
  otherCustomerToken = signJwt(otherCustomer.id);

  const otherBooking = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: otherCustomer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2025-12-01'),
      endDate: new Date('2025-12-03'),
      plan: 'DAILY',
      status: 'VEHICLE_PREPARED',
      baseAmount: 200,
      taxAmount: 21,
      serviceCharge: 10,
      totalAmount: 231,
      currency: 'USD',
    },
  });
  otherBookingId = otherBooking.id;
});

afterAll(async () => {
  await prisma.otp.deleteMany({ where: { bookingId: { in: [bookingId, otherBookingId] } } });
  await prisma.booking.deleteMany({ where: { id: { in: [bookingId, otherBookingId] } } });
  await prisma.user.deleteMany({ where: { email: 'other-otp-verify@test.test' } });
  await prisma.$disconnect();
});

import { POST } from './route';

describe('POST /api/bookings/[id]/otp/verify', () => {
  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingId}/otp/verify`, { code: correctCode }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 (not 403) when customer tries a booking they do not own — no info leak', async () => {
    mockAuth(otherCustomerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingId}/otp/verify`, { code: correctCode }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    // Must be 404, not 403, to avoid confirming the booking exists
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid OTP format (non-digits)', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingId}/otp/verify`, { code: 'abcdef' }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(400);
  });

  it('returns 422 with error=invalid for wrong code', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingId}/otp/verify`, { code: '000000' }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('invalid');
  });

  it('returns 200 { verified: true } for correct code', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingId}/otp/verify`, { code: correctCode }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
    // Response must NOT contain the code or codeHash
    expect(JSON.stringify(body)).not.toContain(correctCode);
    expect(JSON.stringify(body)).not.toContain('codeHash');
  });

  it('returns 422 with error=consumed on second verify attempt', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingId}/otp/verify`, { code: correctCode }),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('consumed');
  });
});
