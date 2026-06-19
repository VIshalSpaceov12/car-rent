import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { transmissionToDb, fuelTypeToDb, type Transmission, type FuelType } from '@car-rental/types';
import { vehicleToDTO } from '@/server/mappers';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryId = url.searchParams.get('categoryId') ?? undefined;
  const transmission = url.searchParams.get('transmission') as Transmission | null;
  const fuelType = url.searchParams.get('fuelType') as FuelType | null;
  const minPrice = url.searchParams.get('minPrice');
  const maxPrice = url.searchParams.get('maxPrice');
  const q = url.searchParams.get('q') ?? undefined;

  // Resolve demo provider: slug 'drivehub' or first provider
  const provider =
    (await prisma.provider.findFirst({ where: { slug: 'drivehub' } })) ??
    (await prisma.provider.findFirst());

  if (!provider) return NextResponse.json([], { status: 200 });

  const where: Prisma.VehicleWhereInput = {
    providerId: provider.id,
    status: 'ACTIVE',
  };

  if (categoryId) where.categoryId = categoryId;
  if (transmission) where.transmission = transmissionToDb(transmission) as 'AUTOMATIC' | 'MANUAL';
  if (fuelType) where.fuelType = fuelTypeToDb(fuelType) as 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
  if (minPrice || maxPrice) {
    const priceFilter: { gte?: Prisma.Decimal; lte?: Prisma.Decimal } = {};
    if (minPrice) priceFilter.gte = new Prisma.Decimal(minPrice);
    if (maxPrice) priceFilter.lte = new Prisma.Decimal(maxPrice);
    where.pricePerDay = priceFilter;
  }
  if (q) where.name = { contains: q, mode: 'insensitive' };

  const vehicles = await prisma.vehicle.findMany({
    where,
    include: { category: true },
    orderBy: { pricePerDay: 'asc' },
  });

  return NextResponse.json(
    vehicles.map((v) => ({
      ...vehicleToDTO(v),
      categoryName: v.category.name,
    }))
  );
}
