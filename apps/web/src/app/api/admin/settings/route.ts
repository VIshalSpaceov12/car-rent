import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { verifySession, requireRole } from '@/server/auth/dal';

const settingsPatchSchema = z.object({
  platformName: z.string().min(1).max(100).optional(),
  supportEmail: z.string().email().optional(),
  defaultLocale: z.enum(['EN', 'AR']).optional(),
});

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    platformName: settings.platformName,
    supportEmail: settings.supportEmail,
    defaultLocale: settings.defaultLocale.toLowerCase(),
    updatedAt: settings.updatedAt.toISOString(),
  });
}

export async function PATCH(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  // Upsert the singleton (in case it was never seeded)
  const updated = await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: {
      ...(parsed.data.platformName !== undefined && { platformName: parsed.data.platformName }),
      ...(parsed.data.supportEmail !== undefined && { supportEmail: parsed.data.supportEmail }),
      ...(parsed.data.defaultLocale !== undefined && {
        defaultLocale: parsed.data.defaultLocale as 'EN' | 'AR',
      }),
    },
    create: {
      id: 'singleton',
      platformName: parsed.data.platformName ?? 'Platform',
      supportEmail: parsed.data.supportEmail ?? 'support@platform.test',
      defaultLocale: (parsed.data.defaultLocale ?? 'EN') as 'EN' | 'AR',
    },
  });

  return NextResponse.json({
    platformName: updated.platformName,
    supportEmail: updated.supportEmail,
    defaultLocale: updated.defaultLocale.toLowerCase(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}
