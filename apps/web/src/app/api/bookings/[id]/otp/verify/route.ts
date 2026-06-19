import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import { otpVerifySchema } from '@car-rental/types';
import { verifyOtp, OtpError } from '@/server/modules/otp/otp';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Only customers can verify OTPs
  if (user.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  // Ownership check — return 404 (not 403) to avoid confirming booking existence to non-owners
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.customerId !== user.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    await verifyOtp(id, parsed.data.code);
  } catch (err) {
    if (err instanceof OtpError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    throw err;
  }

  return NextResponse.json({ verified: true });
}
