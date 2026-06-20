import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { verifySession, requireRole } from '@/server/auth/dal';
import { hashPassword } from '@/server/auth/password';

const providerOnboardSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  colors: z
    .object({
      primary: z.string().min(1),
      primaryDark: z.string().min(1),
    })
    .optional()
    .default({ primary: '#F97316', primaryDark: '#EA580C' }),
  defaultLocale: z.enum(['EN', 'AR']).optional().default('EN'),
  logoUrl: z.string().url().optional(),
  // Owner account
  ownerName: z.string().min(1).max(100),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  // These are ignored/overridden server-side — declared so callers don't get 400 on extra fields
  ownerRole: z.string().optional(),
});

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const providers = await prisma.provider.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          users: true,
          vehicles: true,
          bookings: true,
        },
      },
    },
  });

  return NextResponse.json(
    providers.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      logoUrl: p.logoUrl,
      colors: p.colors,
      defaultLocale: p.defaultLocale.toLowerCase(),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      counts: {
        users: p._count.users,
        vehicles: p._count.vehicles,
        bookings: p._count.bookings,
      },
    })),
  );
}

export async function POST(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = providerOnboardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const { name, slug, colors, defaultLocale, logoUrl, ownerName, ownerEmail, ownerPassword } = parsed.data;

  // Check slug uniqueness
  const existing = await prisma.provider.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
  }

  // Check email uniqueness
  const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (existingUser) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 });
  }

  const passwordHash = await hashPassword(ownerPassword);

  // Create provider + BusinessSettings + owner user atomically
  const provider = await prisma.$transaction(async (tx) => {
    const newProvider = await tx.provider.create({
      data: {
        name,
        slug,
        colors,
        defaultLocale: defaultLocale as 'EN' | 'AR',
        logoUrl,
        status: 'active',
      },
    });

    await tx.businessSettings.create({
      data: {
        providerId: newProvider.id,
        currency: 'USD',
        taxRatePct: 0,
        planMultipliers: { daily: 1, weekly: 0.9, monthly: 0.8, 'long-term': 0.7 },
        serviceChargePct: 0,
      },
    });

    // Role is always PROVIDER regardless of what caller sends — server-authoritative
    await tx.user.create({
      data: {
        email: ownerEmail,
        name: ownerName,
        passwordHash,
        role: 'PROVIDER',
        providerId: newProvider.id,
        locale: defaultLocale as 'EN' | 'AR',
      },
    });

    return newProvider;
  });

  return NextResponse.json(
    {
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      status: provider.status,
      createdAt: provider.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
