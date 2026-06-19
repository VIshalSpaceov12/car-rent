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
    update: {
      planMultipliers: { daily: 1, weekly: 0.9, monthly: 0.8, 'long-term': 0.7 },
      serviceChargePct: 3.5,
    },
    create: {
      providerId: provider.id,
      currency: 'USD',
      taxRatePct: 5,
      planMultipliers: { daily: 1, weekly: 0.9, monthly: 0.8, 'long-term': 0.7 },
      serviceChargePct: 3.5,
    },
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

  // ---- Demo bookings -------------------------------------------------------
  const customer = await prisma.user.findUniqueOrThrow({ where: { email: 'customer@demo.test' } });
  const settings = await prisma.businessSettings.findUniqueOrThrow({ where: { providerId: provider.id } });
  const vehicle1 = await prisma.vehicle.findFirstOrThrow({ where: { providerId: provider.id, name: 'Toyota Corolla 2022' } });
  const vehicle2 = await prisma.vehicle.findFirstOrThrow({ where: { providerId: provider.id, name: 'Ford Explorer 2023' } });

  // Booking 1: reserved — 7 days, daily plan, Toyota Corolla
  const b1Key = { providerId: provider.id, customerId: customer.id, vehicleId: vehicle1.id, startDate: new Date('2026-07-01') };
  const existingB1 = await prisma.booking.findFirst({ where: b1Key });
  if (!existingB1) {
    const days = 7;
    const baseRate = Number(vehicle1.pricePerDay);
    const planMult = 1.0; // daily
    const seasonalMult = 1.0;
    const taxRatePct = Number(settings.taxRatePct);
    const serviceChargePct = Number(settings.serviceChargePct);
    const subtotal = Math.round(days * baseRate * planMult * seasonalMult * 100) / 100;
    const taxAmount = Math.round(subtotal * (taxRatePct / 100) * 100) / 100;
    const serviceCharge = Math.round(subtotal * (serviceChargePct / 100) * 100) / 100;
    await prisma.booking.create({
      data: {
        providerId: provider.id,
        customerId: customer.id,
        vehicleId: vehicle1.id,
        pickupBranchId: branchMap['downtown-drivehub'],
        dropoffBranchId: branchMap['downtown-drivehub'],
        startDate: new Date('2026-07-01'),
        endDate: new Date('2026-07-08'),
        plan: 'DAILY',
        status: 'RESERVED',
        baseAmount: subtotal,
        taxAmount,
        serviceCharge,
        totalAmount: Math.round((subtotal + taxAmount + serviceCharge) * 100) / 100,
        currency: settings.currency,
      },
    });
  }

  // Booking 2: confirmed — 14 days, weekly plan, Ford Explorer
  const b2Key = { providerId: provider.id, customerId: customer.id, vehicleId: vehicle2.id, startDate: new Date('2026-08-01') };
  const existingB2 = await prisma.booking.findFirst({ where: b2Key });
  if (!existingB2) {
    const days = 14;
    const baseRate = Number(vehicle2.pricePerDay);
    const planMult = 0.9; // weekly
    const seasonalMult = 1.0;
    const taxRatePct = Number(settings.taxRatePct);
    const serviceChargePct = Number(settings.serviceChargePct);
    const subtotal = Math.round(days * baseRate * planMult * seasonalMult * 100) / 100;
    const taxAmount = Math.round(subtotal * (taxRatePct / 100) * 100) / 100;
    const serviceCharge = Math.round(subtotal * (serviceChargePct / 100) * 100) / 100;
    await prisma.booking.create({
      data: {
        providerId: provider.id,
        customerId: customer.id,
        vehicleId: vehicle2.id,
        pickupBranchId: branchMap['airport-drivehub'],
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-15'),
        plan: 'WEEKLY',
        status: 'CONFIRMED',
        baseAmount: subtotal,
        taxAmount,
        serviceCharge,
        totalAmount: Math.round((subtotal + taxAmount + serviceCharge) * 100) / 100,
        currency: settings.currency,
      },
    });
  }

  // ---- Demo payment: PAID for the confirmed booking -----------------------
  // Find the confirmed booking (Booking 2: Ford Explorer, CONFIRMED)
  const confirmedBooking = await prisma.booking.findFirst({
    where: {
      providerId: provider.id,
      customerId: customer.id,
      vehicleId: vehicle2.id,
      startDate: new Date('2026-08-01'),
      status: 'CONFIRMED',
    },
  });
  if (confirmedBooking) {
    const existingPayment = await prisma.payment.findUnique({
      where: { bookingId: confirmedBooking.id },
    });
    if (!existingPayment) {
      await prisma.payment.create({
        data: {
          providerId: provider.id,
          bookingId: confirmedBooking.id,
          amount: confirmedBooking.totalAmount,
          currency: confirmedBooking.currency,
          method: 'CARD',
          status: 'PAID',
        },
      });
    }
  }

  // ---- Engagement / Ops seed data -----------------------------------------

  // LoyaltyAccount for customer@demo.test
  const customerUser = await prisma.user.findUniqueOrThrow({ where: { email: 'customer@demo.test' } });
  await prisma.loyaltyAccount.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: { userId: customerUser.id, points: 150 },
  });

  // LoyaltyEntry — welcome bonus (idempotent via findFirst guard)
  const existingWelcomeEntry = await prisma.loyaltyEntry.findFirst({
    where: { userId: customerUser.id, reason: 'Welcome bonus' },
  });
  if (!existingWelcomeEntry) {
    await prisma.loyaltyEntry.create({
      data: { userId: customerUser.id, delta: 150, reason: 'Welcome bonus' },
    });
  }

  // Saved address for customer@demo.test
  const existingAddress = await prisma.address.findFirst({
    where: { userId: customerUser.id, label: 'Home' },
  });
  if (!existingAddress) {
    await prisma.address.create({
      data: {
        userId: customerUser.id,
        label: 'Home',
        line1: '42 Elm Street',
        city: 'New York',
        country: 'US',
        isDefault: true,
      },
    });
  }

  // DiscountCode WELCOME10 for DriveHub (percent 10%)
  await prisma.discountCode.upsert({
    where: { providerId_code: { providerId: provider.id, code: 'WELCOME10' } },
    update: {},
    create: {
      providerId: provider.id,
      code: 'WELCOME10',
      kind: 'PERCENT',
      value: 10,
      active: true,
    },
  });

  // Open support ticket from customer
  const existingTicket = await prisma.supportTicket.findFirst({
    where: { userId: customerUser.id, subject: 'Issue with my booking confirmation' },
  });
  if (!existingTicket) {
    await prisma.supportTicket.create({
      data: {
        providerId: provider.id,
        userId: customerUser.id,
        subject: 'Issue with my booking confirmation',
        body: 'I booked a Toyota Corolla but did not receive a confirmation email. Please help.',
        status: 'OPEN',
      },
    });
  }

  console.log('Seeded provider DriveHub + 4 users + 3 categories + 2 branches + 5 vehicles + 2 bookings + 1 payment + engagement data (password:', PASS, ')');
}
main().finally(() => prisma.$disconnect());
