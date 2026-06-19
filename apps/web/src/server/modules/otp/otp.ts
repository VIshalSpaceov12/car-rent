import 'server-only';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '@/server/db';

const OTP_DIGITS = 6;
const OTP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

export class OtpError extends Error {
  constructor(
    public readonly code: 'not_found' | 'expired' | 'consumed' | 'locked' | 'invalid',
    message: string
  ) {
    super(message);
    this.name = 'OtpError';
  }
}

/** Returns a cryptographically random 6-digit string. Never Math.random. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_DIGITS, '0');
}

/**
 * Issues an OTP for the given booking.
 * Hashes the code with bcrypt, upserts the Otp row, and returns the
 * plaintext code ONCE. Never logs it.
 */
export async function issueOtp(booking: {
  id: string;
  vehicleId: string;
  providerId: string;
}): Promise<string> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_WINDOW_MS);

  await prisma.otp.upsert({
    where: { bookingId: booking.id },
    create: {
      bookingId: booking.id,
      vehicleId: booking.vehicleId,
      providerId: booking.providerId,
      codeHash,
      expiresAt,
      attempts: 0,
      consumedAt: null,
    },
    update: {
      codeHash,
      expiresAt,
      attempts: 0,
      consumedAt: null,
    },
  });

  // Plaintext returned ONCE to caller — never stored, never logged.
  return code;
}

/**
 * Server-authoritative OTP verification.
 * Throws OtpError on any failure condition.
 * On success, marks the OTP as consumed (single-use).
 */
export async function verifyOtp(bookingId: string, code: string): Promise<void> {
  const otp = await prisma.otp.findUnique({ where: { bookingId } });

  if (!otp) {
    throw new OtpError('not_found', 'No OTP issued for this booking');
  }

  if (otp.expiresAt < new Date()) {
    throw new OtpError('expired', 'OTP has expired');
  }

  if (otp.consumedAt !== null) {
    throw new OtpError('consumed', 'OTP has already been used');
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new OtpError('locked', 'Too many incorrect attempts — OTP is locked');
  }

  const match = await bcrypt.compare(code, otp.codeHash);

  if (!match) {
    await prisma.otp.update({
      where: { bookingId },
      data: { attempts: otp.attempts + 1 },
    });
    throw new OtpError('invalid', 'Incorrect OTP code');
  }

  // Consume on success
  await prisma.otp.update({
    where: { bookingId },
    data: { consumedAt: new Date() },
  });
}
