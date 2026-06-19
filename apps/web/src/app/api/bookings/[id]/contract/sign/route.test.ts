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
function postReq(url: string, body?: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

let customerToken: string;
let bookingIdUnsigned: string;   // has consumed OTP, ready to sign
let bookingIdNoOtp: string;      // no OTP row at all

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

  // Booking 1: vehicle-prepared + consumed OTP (ready to sign)
  const b1 = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-03'),
      plan: 'DAILY',
      status: 'VEHICLE_PREPARED',
      baseAmount: 200,
      taxAmount: 21,
      serviceCharge: 10,
      totalAmount: 231,
      currency: 'USD',
    },
  });
  bookingIdUnsigned = b1.id;

  const hash = await bcrypt.hash('111111', 10);
  await prisma.otp.create({
    data: {
      bookingId: b1.id,
      vehicleId: vehicle.id,
      providerId: provider.providerId!,
      codeHash: hash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      attempts: 1,
      consumedAt: new Date(), // already consumed
    },
  });

  // Booking 2: vehicle-prepared, no OTP at all
  const b2 = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-03'),
      plan: 'DAILY',
      status: 'VEHICLE_PREPARED',
      baseAmount: 200,
      taxAmount: 21,
      serviceCharge: 10,
      totalAmount: 231,
      currency: 'USD',
    },
  });
  bookingIdNoOtp = b2.id;
});

afterAll(async () => {
  await prisma.contract.deleteMany({ where: { bookingId: { in: [bookingIdUnsigned, bookingIdNoOtp] } } });
  await prisma.otp.deleteMany({ where: { bookingId: { in: [bookingIdUnsigned, bookingIdNoOtp] } } });
  await prisma.booking.deleteMany({ where: { id: { in: [bookingIdUnsigned, bookingIdNoOtp] } } });
  await prisma.$disconnect();
});

import { POST } from './route';

describe('POST /api/bookings/[id]/contract/sign', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(headers).mockResolvedValue({ get: () => null } as never);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingIdUnsigned}/contract/sign`, {
        signatureName: 'John Doe', agree: true,
      }),
      { params: Promise.resolve({ id: bookingIdUnsigned }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing signatureName', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingIdUnsigned}/contract/sign`, {
        agree: true,
      }),
      { params: Promise.resolve({ id: bookingIdUnsigned }) }
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when agree is not true', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingIdUnsigned}/contract/sign`, {
        signatureName: 'John Doe', agree: false,
      }),
      { params: Promise.resolve({ id: bookingIdUnsigned }) }
    );
    expect(res.status).toBe(400);
  });

  it('returns 422 otp_not_consumed when no OTP has been verified', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingIdNoOtp}/contract/sign`, {
        signatureName: 'John Doe', agree: true,
      }),
      { params: Promise.resolve({ id: bookingIdNoOtp }) }
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('otp_not_consumed');
  });

  it('succeeds and transitions booking to picked-up', async () => {
    mockAuth(customerToken);
    const res = await POST(
      postReq(`http://localhost/api/bookings/${bookingIdUnsigned}/contract/sign`, {
        signatureName: 'John Doe', agree: true,
      }),
      { params: Promise.resolve({ id: bookingIdUnsigned }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.contract).toBeDefined();
    expect(body.booking.status).toBe('picked-up');

    // Verify in DB
    const db = await prisma.booking.findUnique({ where: { id: bookingIdUnsigned } });
    expect(db!.status).toBe('PICKED_UP');
  });
});
