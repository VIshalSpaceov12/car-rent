import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import type { LoyaltyAccountDTO, LoyaltyEntryDTO } from '@car-rental/types';

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'customer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const [account, entries] = await Promise.all([
    prisma.loyaltyAccount.findUnique({ where: { userId: user.id } }),
    prisma.loyaltyEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const accountDTO: LoyaltyAccountDTO | null = account
    ? {
        id: account.id,
        userId: account.userId,
        points: account.points,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      }
    : null;

  const entryDTOs: LoyaltyEntryDTO[] = entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    delta: e.delta,
    reason: e.reason,
    ...(e.bookingId ? { bookingId: e.bookingId } : {}),
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json({ account: accountDTO, entries: entryDTOs });
}
