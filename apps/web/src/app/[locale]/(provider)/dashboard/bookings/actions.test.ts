import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers before importing anything that pulls in server-only dal
vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

// Mock next/navigation so redirect() doesn't throw (it normally throws a special
// Next.js error that exits the function; for the otp_required path we return
// before reaching redirect, but mock it to be safe).
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    provider: { findUnique: vi.fn() },
    booking: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { headers, cookies } from 'next/headers';
import { prisma } from '@/server/db';
import { signJwt } from '@/server/auth/jwt';
import { transitionBooking } from './actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockProviderAuth(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  providerId: string;
  locale: string;
}) {
  const token = signJwt(user.id);
  vi.mocked(headers).mockResolvedValue({
    get: (name: string) => (name === 'authorization' ? `Bearer ${token}` : null),
  } as never);
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
  vi.mocked(prisma.provider.findUnique).mockResolvedValue({ status: 'active' } as never);
}

const PROVIDER_USER = {
  id: 'provider-u1',
  email: 'provider@test.test',
  name: 'Test Provider',
  role: 'PROVIDER',
  providerId: 'prov-1',
  locale: 'EN',
};

const VEHICLE_PREPARED_BOOKING = {
  id: 'booking-vp-1',
  providerId: 'prov-1',
  customerId: 'cust-1',
  vehicleId: 'veh-1',
  status: 'VEHICLE_PREPARED',
  baseAmount: 200,
  taxAmount: 21,
  serviceCharge: 10,
  totalAmount: 231,
  currency: 'USD',
  startDate: new Date('2026-08-01'),
  endDate: new Date('2026-08-03'),
  plan: 'DAILY',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('transitionBooking server action — OTP lockbox guard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns { error: "otp_required" } when next === "picked-up" (vehicle-prepared booking)', async () => {
    mockProviderAuth(PROVIDER_USER);
    vi.mocked(prisma.booking.findFirst).mockResolvedValue(VEHICLE_PREPARED_BOOKING as never);

    const result = await transitionBooking('en', VEHICLE_PREPARED_BOOKING.id, 'picked-up');

    expect(result).toEqual({ error: 'otp_required' });
  });

  it('does NOT call prisma.booking.update when next === "picked-up"', async () => {
    mockProviderAuth(PROVIDER_USER);
    vi.mocked(prisma.booking.findFirst).mockResolvedValue(VEHICLE_PREPARED_BOOKING as never);

    await transitionBooking('en', VEHICLE_PREPARED_BOOKING.id, 'picked-up');

    expect(prisma.booking.update).not.toHaveBeenCalled();
  });
});
