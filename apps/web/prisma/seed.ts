import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PASS = 'Password123!';

async function main() {
  const passwordHash = await bcrypt.hash(PASS, 10);
  const provider = await prisma.provider.upsert({
    where: { slug: 'drivehub' },
    update: {},
    create: {
      name: 'DriveHub', slug: 'drivehub',
      colors: { primary: '#F97316', primaryDark: '#EA580C' },
    },
  });
  await prisma.businessSettings.upsert({
    where: { providerId: provider.id },
    update: {},
    create: { providerId: provider.id, currency: 'USD', taxRatePct: 5 },
  });
  const users: Array<[string, 'ADMIN'|'PROVIDER'|'STAFF'|'CUSTOMER', string | null, string]> = [
    ['admin@demo.test', 'ADMIN', null, 'Platform Admin'],
    ['provider@demo.test', 'PROVIDER', provider.id, 'DriveHub Owner'],
    ['staff@demo.test', 'STAFF', provider.id, 'DriveHub Staff'],
    ['customer@demo.test', 'CUSTOMER', null, 'Demo Customer'],
  ];
  for (const [email, role, providerId, name] of users) {
    await prisma.user.upsert({
      where: { email }, update: {},
      create: { email, role, providerId, name, passwordHash },
    });
  }

  // ---- Vehicle categories --------------------------------------------------
  const categories = [
    { slug: 'economy',  name: 'Economy' },
    { slug: 'suv',      name: 'SUV' },
    { slug: 'luxury',   name: 'Luxury' },
  ];
  const categoryMap: Record<string, string> = {};
  for (const { slug, name } of categories) {
    const cat = await prisma.vehicleCategory.upsert({
      where: { providerId_slug: { providerId: provider.id, slug } },
      update: {},
      create: { providerId: provider.id, name, slug },
    });
    categoryMap[slug] = cat.id;
  }

  // ---- Branches ------------------------------------------------------------
  const branches = [
    {
      slug: 'downtown-drivehub',
      name: 'Downtown Branch',
      address: '123 Main Street, Downtown',
      phone: '+1-555-0100',
      lat: 40.7128,
      lng: -74.006,
    },
    {
      slug: 'airport-drivehub',
      name: 'Airport Branch',
      address: 'Terminal 2, JFK International Airport',
      phone: '+1-555-0200',
      lat: 40.6413,
      lng: -73.7781,
    },
  ];
  const branchMap: Record<string, string> = {};
  for (const { slug, ...data } of branches) {
    // Branches don't have a unique slug in schema; use name as identifier
    const existing = await prisma.branch.findFirst({
      where: { providerId: provider.id, name: data.name },
    });
    const branch = existing
      ? existing
      : await prisma.branch.create({ data: { providerId: provider.id, ...data } });
    branchMap[slug] = branch.id;
  }

  // ---- Vehicles ------------------------------------------------------------
  type VehicleSpec = {
    name: string;
    make: string;
    model: string;
    year: number;
    transmission: 'AUTOMATIC' | 'MANUAL';
    fuelType: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
    pricePerDay: number;
    seats: number;
    categorySlug: string;
    branchSlug: string;
  };
  const vehicleSpecs: VehicleSpec[] = [
    {
      name: 'Toyota Corolla 2022',
      make: 'Toyota', model: 'Corolla', year: 2022,
      transmission: 'AUTOMATIC', fuelType: 'PETROL',
      pricePerDay: 45, seats: 5,
      categorySlug: 'economy', branchSlug: 'downtown-drivehub',
    },
    {
      name: 'Hyundai Elantra 2023',
      make: 'Hyundai', model: 'Elantra', year: 2023,
      transmission: 'MANUAL', fuelType: 'PETROL',
      pricePerDay: 39, seats: 5,
      categorySlug: 'economy', branchSlug: 'airport-drivehub',
    },
    {
      name: 'Ford Explorer 2023',
      make: 'Ford', model: 'Explorer', year: 2023,
      transmission: 'AUTOMATIC', fuelType: 'PETROL',
      pricePerDay: 95, seats: 7,
      categorySlug: 'suv', branchSlug: 'downtown-drivehub',
    },
    {
      name: 'Toyota RAV4 Hybrid 2024',
      make: 'Toyota', model: 'RAV4', year: 2024,
      transmission: 'AUTOMATIC', fuelType: 'HYBRID',
      pricePerDay: 85, seats: 5,
      categorySlug: 'suv', branchSlug: 'airport-drivehub',
    },
    {
      name: 'Mercedes-Benz E-Class 2023',
      make: 'Mercedes-Benz', model: 'E-Class', year: 2023,
      transmission: 'AUTOMATIC', fuelType: 'DIESEL',
      pricePerDay: 175, seats: 5,
      categorySlug: 'luxury', branchSlug: 'downtown-drivehub',
    },
  ];
  for (const { name, make, model, year, transmission, fuelType, pricePerDay, seats, categorySlug, branchSlug } of vehicleSpecs) {
    const existing = await prisma.vehicle.findFirst({
      where: { providerId: provider.id, name },
    });
    if (!existing) {
      await prisma.vehicle.create({
        data: {
          providerId: provider.id,
          categoryId: categoryMap[categorySlug]!,
          branchId: branchMap[branchSlug],
          name, make, model, year,
          transmission, fuelType,
          status: 'ACTIVE',
          pricePerDay,
          seats,
        },
      });
    }
  }

  console.log('Seeded provider DriveHub + 4 users + 3 categories + 2 branches + 5 vehicles (password:', PASS, ')');
}
main().finally(() => prisma.$disconnect());
