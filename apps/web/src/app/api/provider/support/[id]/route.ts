import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole } from '@/server/auth/dal';
import { supportStatusFromDb, type SupportTicketDTO } from '@car-rental/types';
import { z } from 'zod';

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

const respondSchema = z.object({
  response: z.string().min(1),
  status: z.enum(['resolved', 'open']).optional().default('resolved'),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try { requireRole(user, 'provider', 'staff', 'admin'); } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (user.role !== 'admin' && !user.providerId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const { id } = await params;
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, providerId: user.providerId! },
  });
  if (!ticket) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const dbStatus = parsed.data.status === 'resolved' ? 'RESOLVED' : 'OPEN';

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: { response: parsed.data.response, status: dbStatus },
  });

  return NextResponse.json(toDTO(updated));
}
