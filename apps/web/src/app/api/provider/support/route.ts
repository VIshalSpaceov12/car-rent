import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { supportStatusFromDb, type SupportTicketDTO } from '@car-rental/types';

function toDTO(t: {
  id: string; providerId: string; userId: string; subject: string; body: string;
  status: string; response: string | null; createdAt: Date; updatedAt: Date;
}): SupportTicketDTO {
  const dto: SupportTicketDTO = {
    id: t.id, providerId: t.providerId, userId: t.userId,
    subject: t.subject, body: t.body,
    status: supportStatusFromDb(t.status),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
  if (t.response) dto.response = t.response;
  return dto;
}

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try { requireRole(user, 'provider', 'staff', 'admin'); } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const tickets = await prisma.supportTicket.findMany({
    where: tenantScope(user),
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(tickets.map(toDTO));
}
