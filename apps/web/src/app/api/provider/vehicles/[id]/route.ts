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

  const body = await req.json().catch(() => null);
  const parsed = vehicleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { providerId: _pId, transmission, fuelType, status, categoryId: newCategoryId, ...rest } = parsed.data as typeof parsed.data & { providerId?: string; categoryId?: string };

  // If categoryId is being updated, verify it belongs to the session tenant
  if (newCategoryId) {
    const cat = await prisma.vehicleCategory.findFirst({ where: { id: newCategoryId, ...tenantScope(user) } });
    if (!cat) return NextResponse.json({ error: 'category_not_found' }, { status: 422 });
  }

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
  if (newCategoryId) updateData.categoryId = newCategoryId;
  if (transmission) updateData.transmission = transmissionToDb(transmission) as 'AUTOMATIC' | 'MANUAL';
  if (fuelType) updateData.fuelType = fuelTypeToDb(fuelType) as 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
  if (status) updateData.status = vehicleStatusToDb(status) as 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';

  // Atomic tenant-scoped update — where includes providerId so cross-tenant writes are impossible
  const result = await prisma.vehicle.updateMany({
    where: { id, ...tenantScope(user) },
    data: updateData,
  });
  if (result.count === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const vehicle = await prisma.vehicle.findFirst({
    where: { id },
    include: { category: true, branch: true },
  });
  if (!vehicle) return NextResponse.json({ error: 'not_found' }, { status: 404 });

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

  // Atomic tenant-scoped delete — cross-tenant deletes return count=0
  const result = await prisma.vehicle.deleteMany({ where: { id, ...tenantScope(user) } });
  if (result.count === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
