import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { DEFAULT_PRIMARY, DEFAULT_PRIMARY_DARK } from '@/lib/brandDefaults';

/**
 * GET /api/branding
 *
 * Returns the active tenant's brand config for the mobile app.
 * Prefers the 'drivehub' slug, falls back to the first active provider,
 * then to platform defaults if no providers exist.
 * Public endpoint — no auth required (branding is not sensitive).
 */
export async function GET() {
  // Try the demo provider first, then any active provider
  const provider =
    (await prisma.provider.findFirst({
      where: { slug: 'drivehub', status: 'active' },
      select: { name: true, logoUrl: true, colors: true },
    })) ??
    (await prisma.provider.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { name: true, logoUrl: true, colors: true },
    }));

  const colors = provider?.colors as { primary?: string; primaryDark?: string } | null | undefined;

  return NextResponse.json({
    name: provider?.name ?? 'DriveHub',
    primary: colors?.primary ?? DEFAULT_PRIMARY,
    primaryDark: colors?.primaryDark ?? DEFAULT_PRIMARY_DARK,
    logoUrl: provider?.logoUrl ?? null,
  });
}
