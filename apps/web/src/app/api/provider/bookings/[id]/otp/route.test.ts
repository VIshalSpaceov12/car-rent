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

function postReq(url: string, body?: unknown, token?: string) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

let providerToken: string;
let customerToken: string;
let bookingId: string;
let providerUser: { id: string; providerId: string | null };

beforeAll(async () => {
  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);
  providerUser = provider;

  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  const vehicle = await prisma.vehicle.findFirst({
    where: { providerId: provider.providerId!, status: 'ACTIVE' },
  });
  if (!vehicle) throw new Error('No ACTIVE vehicle for provider');

  const booking = await prisma.booking.create({
    data: {
      providerId: provider.providerId!,
      customerId: customer.id,
      vehicleId: vehicle.id,
      startDate: new Date('2025-10-01'),
      endDate: new Date('2025-10-03'),
      plan: 'DAILY',
      status: 'CONFIRMED',
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
  await prisma.otp.deleteMany({ where: { bookingId } });
  await prisma.booking.deleteMany({ where: { id: bookingId } });
  await prisma.$disconnect();
});

import { POST as issueOtpPost } from './route';

describe('POST /api/provider/bookings/[id]/otp', () => {
  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await issueOtpPost(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/otp`),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when customer tries to issue OTP', async () => {
    mockAuth(customerToken);
    const res = await issueOtpPost(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/otp`),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(403);
  });

  it('returns { code } with 6-digit string and auto-prepares booking', async () => {
    mockAuth(providerToken);
    const res = await issueOtpPost(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/otp`),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.code).toMatch(/^\d{6}$/);

    // Booking should have been moved to vehicle-prepared
    const db = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(db!.status).toBe('VEHICLE_PREPARED');
  });

  it('returned code is NOT persisted in codeHash as plaintext', async () => {
    const otp = await prisma.otp.findUnique({ where: { bookingId } });
    expect(otp).not.toBeNull();
    // codeHash starts with bcrypt prefix $2b$
    expect(otp!.codeHash).toMatch(/^\$2[ab]\$/);
    // codeHash is not 6 digits
    expect(otp!.codeHash).not.toMatch(/^\d{6}$/);
  });

  it('can re-issue OTP (upserts — new hash, reset attempts)', async () => {
    mockAuth(providerToken);
    const firstOtp = await prisma.otp.findUnique({ where: { bookingId } });
    const res = await issueOtpPost(
      postReq(`http://localhost/api/provider/bookings/${bookingId}/otp`),
      { params: Promise.resolve({ id: bookingId }) }
    );
    expect(res.status).toBe(201);
    const secondOtp = await prisma.otp.findUnique({ where: { bookingId } });
    expect(secondOtp!.codeHash).not.toBe(firstOtp!.codeHash);
    expect(secondOtp!.attempts).toBe(0);
  });

  it('returns 404 for non-existent booking', async () => {
    mockAuth(providerToken);
    const res = await issueOtpPost(
      postReq(`http://localhost/api/provider/bookings/no-such-id/otp`),
      { params: Promise.resolve({ id: 'no-such-id' }) }
    );
    expect(res.status).toBe(404);
  });
});
