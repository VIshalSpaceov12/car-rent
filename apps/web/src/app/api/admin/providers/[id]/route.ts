import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { verifySession, requireRole } from '@/server/auth/dal';

const providerPatchSchema = z.object({
  status: z.enum(['active', 'suspended', 'pending']).optional(),
  name: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().optional().nullable(),
  colors: z
    .object({
      primary: z.string().min(1),
      primaryDark: z.string().min(1),
    })
    .optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = providerPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const provider = await prisma.provider.findUnique({ where: { id } });
  if (!provider) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const updated = await prisma.provider.update({
    where: { id },
    data: {
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.logoUrl !== undefined && { logoUrl: parsed.data.logoUrl }),
      ...(parsed.data.colors !== undefined && { colors: parsed.data.colors }),
    },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    status: updated.status,
    logoUrl: updated.logoUrl,
    colors: updated.colors,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
