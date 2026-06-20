import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { verifySession, requireRole } from '@/server/auth/dal';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const hexColor = z.string().regex(HEX_RE, 'Must be a 6-digit hex color (e.g. #F97316)');

const brandingPatchSchema = z.object({
  primary: hexColor,
  primaryDark: hexColor,
});

export async function PATCH(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'provider', 'staff');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // providerId comes exclusively from the verified session — never from the request body.
  if (!user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const parsed = brandingPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const updated = await prisma.provider.update({
    where: { id: user.providerId },
    data: { colors: { primary: parsed.data.primary, primaryDark: parsed.data.primaryDark } },
    select: { id: true, name: true, slug: true, colors: true, updatedAt: true },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    colors: updated.colors,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
