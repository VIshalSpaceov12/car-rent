import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { vehicleCreateSchema, transmissionToDb, fuelTypeToDb, vehicleStatusToDb } from '@car-rental/types';
import { vehicleToDTO } from '@/server/mappers';

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: tenantScope(user),
    include: { category: true, branch: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(vehicles.map((v) => ({
    ...vehicleToDTO(v),
    categoryName: v.category.name,
    branchName: v.branch?.name ?? null,
  })));
}

export async function POST(req: Request) {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = vehicleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.issues }, { status: 400 });
  }

  // Always use providerId from session; ignore client-supplied providerId
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { providerId: _pId, ...data } = parsed.data as typeof parsed.data & { providerId?: string };
  const resolvedProviderId = user.providerId ?? (user.role === 'admin' ? null : null);
  if (!resolvedProviderId) {
    return NextResponse.json({ error: 'provider_not_associated' }, { status: 422 });
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      ...data,
      providerId: resolvedProviderId,
      transmission: transmissionToDb(data.transmission) as 'AUTOMATIC' | 'MANUAL',
      fuelType: fuelTypeToDb(data.fuelType) as 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID',
      status: vehicleStatusToDb(data.status ?? 'active') as 'ACTIVE' | 'MAINTENANCE' | 'RETIRED',
    },
    include: { category: true, branch: true },
  });

  return NextResponse.json({
    ...vehicleToDTO(vehicle),
    categoryName: vehicle.category.name,
    branchName: vehicle.branch?.name ?? null,
  }, { status: 201 });
}
