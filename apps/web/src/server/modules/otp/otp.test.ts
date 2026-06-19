import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before importing the module under test
vi.mock('@/server/db', () => ({
  prisma: {
    otp: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/server/db';
import { generateCode, issueOtp, verifyOtp, OtpError } from './otp';

const mockUpsert = vi.mocked(prisma.otp.upsert);
const mockFindUnique = vi.mocked(prisma.otp.findUnique);
const mockUpdate = vi.mocked(prisma.otp.update);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateCode', () => {
  it('returns a 6-digit numeric string', () => {
    const code = generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('is not always the same (randomness smoke test)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('issueOtp', () => {
  it('returns a 6-digit plaintext code', async () => {
    mockUpsert.mockResolvedValue({} as never);
    const booking = { id: 'b1', vehicleId: 'v1', providerId: 'p1' };
    const code = await issueOtp(booking);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('calls upsert with a non-empty codeHash and NOT the plaintext code', async () => {
    mockUpsert.mockResolvedValue({} as never);
    const booking = { id: 'b1', vehicleId: 'v1', providerId: 'p1' };
    const code = await issueOtp(booking);
    const call = mockUpsert.mock.calls[0]![0]!;
    const createData = call.create as Record<string, unknown>;
    expect(createData.codeHash).toBeTruthy();
    expect(createData.codeHash).not.toBe(code);
    expect(createData.codeHash).not.toMatch(/^\d{6}$/);
  });

  it('upserts with attempts=0 and consumedAt=null', async () => {
    mockUpsert.mockResolvedValue({} as never);
    const booking = { id: 'b1', vehicleId: 'v1', providerId: 'p1' };
    await issueOtp(booking);
    const call = mockUpsert.mock.calls[0]![0]!;
    const createData = call.create as Record<string, unknown>;
    expect(createData.attempts).toBe(0);
    expect(createData.consumedAt).toBeNull();
  });

  it('sets expiresAt ~24h in the future', async () => {
    mockUpsert.mockResolvedValue({} as never);
    const before = Date.now();
    await issueOtp({ id: 'b1', vehicleId: 'v1', providerId: 'p1' });
    const after = Date.now();
    const call = mockUpsert.mock.calls[0]![0]!;
    const createData = call.create as Record<string, unknown>;
    const exp = (createData.expiresAt as Date).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    expect(exp).toBeGreaterThanOrEqual(before + twentyFourHours - 1000);
    expect(exp).toBeLessThanOrEqual(after + twentyFourHours + 1000);
  });
});

describe('verifyOtp', () => {
  const future = new Date(Date.now() + 60_000);

  it('resolves when code matches and OTP is fresh', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('123456', 10);
    mockFindUnique.mockResolvedValue({
      bookingId: 'b1',
      vehicleId: 'v1',
      codeHash: hash,
      expiresAt: future,
      consumedAt: null,
      attempts: 0,
    } as never);
    mockUpdate.mockResolvedValue({} as never);
    await expect(verifyOtp('b1', '123456')).resolves.toBeUndefined();
  });

  it('sets consumedAt on success', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('654321', 10);
    mockFindUnique.mockResolvedValue({
      bookingId: 'b1', vehicleId: 'v1', codeHash: hash,
      expiresAt: future, consumedAt: null, attempts: 0,
    } as never);
    mockUpdate.mockResolvedValue({} as never);
    await verifyOtp('b1', '654321');
    const updateCall = mockUpdate.mock.calls[0]![0]!;
    const updateData = updateCall.data as Record<string, unknown>;
    expect(updateData.consumedAt).toBeInstanceOf(Date);
  });

  it('throws OtpError(not_found) when no OTP row exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(verifyOtp('no-such-booking', '000000')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('throws OtpError(expired) when expiresAt is in the past', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('123456', 10);
    mockFindUnique.mockResolvedValue({
      bookingId: 'b1', vehicleId: 'v1', codeHash: hash,
      expiresAt: new Date(Date.now() - 1000), consumedAt: null, attempts: 0,
    } as never);
    await expect(verifyOtp('b1', '123456')).rejects.toMatchObject({ code: 'expired' });
  });

  it('throws OtpError(consumed) when already consumed', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('123456', 10);
    mockFindUnique.mockResolvedValue({
      bookingId: 'b1', vehicleId: 'v1', codeHash: hash,
      expiresAt: future, consumedAt: new Date(), attempts: 0,
    } as never);
    await expect(verifyOtp('b1', '123456')).rejects.toMatchObject({ code: 'consumed' });
  });

  it('throws OtpError(locked) when attempts >= 5', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('123456', 10);
    mockFindUnique.mockResolvedValue({
      bookingId: 'b1', vehicleId: 'v1', codeHash: hash,
      expiresAt: future, consumedAt: null, attempts: 5,
    } as never);
    await expect(verifyOtp('b1', 'wrong0')).rejects.toMatchObject({ code: 'locked' });
  });

  it('throws OtpError(invalid) and increments attempts on wrong code', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('123456', 10);
    mockFindUnique.mockResolvedValue({
      bookingId: 'b1', vehicleId: 'v1', codeHash: hash,
      expiresAt: future, consumedAt: null, attempts: 2,
    } as never);
    mockUpdate.mockResolvedValue({} as never);
    await expect(verifyOtp('b1', '999999')).rejects.toMatchObject({ code: 'invalid' });
    const updateCall = mockUpdate.mock.calls[0]![0]!;
    const updateData = updateCall.data as Record<string, unknown>;
    expect(updateData.attempts).toBe(3);
  });

  it('second verify after success (consumed) is rejected', async () => {
    // Simulate: first call sets consumedAt; second call sees consumedAt set
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('123456', 10);
    // First call: OTP is fresh, succeeds
    mockFindUnique.mockResolvedValueOnce({
      bookingId: 'b1', vehicleId: 'v1', codeHash: hash,
      expiresAt: future, consumedAt: null, attempts: 0,
    } as never);
    mockUpdate.mockResolvedValue({} as never);
    await verifyOtp('b1', '123456');
    // Second call: OTP row now has consumedAt set
    mockFindUnique.mockResolvedValueOnce({
      bookingId: 'b1', vehicleId: 'v1', codeHash: hash,
      expiresAt: future, consumedAt: new Date(), attempts: 0,
    } as never);
    await expect(verifyOtp('b1', '123456')).rejects.toMatchObject({ code: 'consumed' });
  });

  it('OTP from booking A cannot verify booking B (bound to booking)', async () => {
    // booking B has no OTP row
    mockFindUnique.mockResolvedValue(null);
    await expect(verifyOtp('booking-b', '123456')).rejects.toMatchObject({ code: 'not_found' });
  });
});
