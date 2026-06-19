import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole } from '@/server/auth/dal';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try { requireRole(user, 'provider', 'admin'); } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const { id } = await params;

  // Only allow deactivating staff within the same tenant
  const staffUser = await prisma.user.findFirst({
    where: { id, role: 'STAFF', providerId: user.providerId! },
  });
  if (!staffUser) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Simple deactivate: we store active status by nulling providerId (detach from tenant)
  // This effectively revokes access without deleting the account
  const action = body?.action;
  if (action === 'deactivate') {
    await prisma.user.update({
      where: { id },
      data: { providerId: null },
    });
    return NextResponse.json({ id, deactivated: true });
  }

  return NextResponse.json({ error: 'invalid_action', message: "Use action: 'deactivate'" }, { status: 400 });
}
