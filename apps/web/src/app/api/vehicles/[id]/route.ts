import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { vehicleToDTO } from '@/server/mappers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, status: 'ACTIVE' },
    include: { category: true, branch: true },
  });

  if (!vehicle) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    ...vehicleToDTO(vehicle),
    categoryName: vehicle.category.name,
    branchName: vehicle.branch?.name ?? null,
  });
}
