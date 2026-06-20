import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole } from '@/server/auth/dal';
import { maintenanceCreateSchema, type MaintenanceRecordDTO } from '@car-rental/types';

function toDTO(r: {
  id: string; providerId: string; vehicleId: string; description: string;
  date: Date; cost: { toString(): string } | number | null; createdAt: Date;
}): MaintenanceRecordDTO {
  const dto: MaintenanceRecordDTO = {
    id: r.id, providerId: r.providerId, vehicleId: r.vehicleId,
    description: r.description,
    date: r.date.toISOString().slice(0, 10),
    createdAt: r.createdAt.toISOString(),
  };
  if (r.cost !== null) dto.cost = Number(r.cost);
  return dto;
}

export async function GET(
  _req: Request,
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

  const { id: vehicleId } = await params;

  // Verify vehicle belongs to this tenant
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, providerId: user.providerId! },
  });
  if (!vehicle) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const records = await prisma.maintenanceRecord.findMany({
    where: { vehicleId, providerId: user.providerId! },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(records.map(toDTO));
}

export async function POST(
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

  const { id: vehicleId } = await params;

  // Verify vehicle belongs to this tenant
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, providerId: user.providerId! },
  });
  if (!vehicle) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  // Strip vehicleId from body — use from URL param only
  const parsed = maintenanceCreateSchema.omit({ vehicleId: true }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  const record = await prisma.maintenanceRecord.create({
    data: {
      vehicleId,
      providerId: user.providerId!,
      description: parsed.data.description,
      date: new Date(parsed.data.date),
      cost: parsed.data.cost ?? null,
    },
  });

  return NextResponse.json(toDTO(record), { status: 201 });
}
