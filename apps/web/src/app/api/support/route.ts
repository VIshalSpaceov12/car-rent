import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession } from '@/server/auth/dal';
import { supportTicketCreateSchema, supportStatusFromDb, type SupportTicketDTO } from '@car-rental/types';
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

const createSchema = supportTicketCreateSchema.extend({
  providerId: z.string().optional(),
});

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'customer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(tickets.map(toDTO));
}

export async function POST(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'customer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const { subject, body: ticketBody, providerId: clientProviderId } = parsed.data;

  // Resolve providerId: from request body, or from the customer's most recent booking
  let resolvedProviderId: string | null = clientProviderId ?? null;

  if (!resolvedProviderId) {
    const latestBooking = await prisma.booking.findFirst({
      where: { customerId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { providerId: true },
    });
    resolvedProviderId = latestBooking?.providerId ?? null;
  }

  if (!resolvedProviderId) {
    return NextResponse.json({ error: 'no_provider', message: 'Cannot determine provider for support ticket' }, { status: 422 });
  }

  // Verify provider exists
  const provider = await prisma.provider.findUnique({ where: { id: resolvedProviderId } });
  if (!provider) {
    return NextResponse.json({ error: 'provider_not_found' }, { status: 404 });
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      providerId: resolvedProviderId,
      subject,
      body: ticketBody,
      status: 'OPEN',
    },
  });

  return NextResponse.json(toDTO(ticket), { status: 201 });
}
