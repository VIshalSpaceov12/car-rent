import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { vehicleUpdateSchema, transmissionToDb, fuelTypeToDb, vehicleStatusToDb } from '@car-rental/types';
import { vehicleToDTO } from '@/server/mappers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, ...tenantScope(user) },
    include: { category: true, branch: true },
  });
  if (!vehicle) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    ...vehicleToDTO(vehicle),
    categoryName: vehicle.category.name,
    branchName: vehicle.branch?.name ?? null,
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Verify ownership
  const existing = await prisma.vehicle.findFirst({
    where: { id, ...tenantScope(user) },
  });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = vehicleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { providerId: _pId, transmission, fuelType, status, ...rest } = parsed.data as typeof parsed.data & { providerId?: string };

  type UpdateData = {
    categoryId?: string;
    branchId?: string;
    name?: string;
    make?: string;
    model?: string;
    year?: number;
    transmission?: 'AUTOMATIC' | 'MANUAL';
    fuelType?: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
    status?: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
    pricePerDay?: number;
    seats?: number;
    imageUrl?: string;
    description?: string;
  };
  const updateData: UpdateData = { ...rest };
  if (transmission) updateData.transmission = transmissionToDb(transmission) as 'AUTOMATIC' | 'MANUAL';
  if (fuelType) updateData.fuelType = fuelTypeToDb(fuelType) as 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
  if (status) updateData.status = vehicleStatusToDb(status) as 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: updateData,
    include: { category: true, branch: true },
  });

  return NextResponse.json({
    ...vehicleToDTO(vehicle),
    categoryName: vehicle.category.name,
    branchName: vehicle.branch?.name ?? null,
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const existing = await prisma.vehicle.findFirst({
    where: { id, ...tenantScope(user) },
  });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.vehicle.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
