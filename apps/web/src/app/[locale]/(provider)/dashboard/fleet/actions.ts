'use server';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import {
  vehicleCreateSchema,
  vehicleUpdateSchema,
  transmissionToDb,
  fuelTypeToDb,
  vehicleStatusToDb,
} from '@car-rental/types';

// ---- helpers ----------------------------------------------------------------

function wrongRoleTarget(role: string, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  return `/${locale}/login`;
}

async function guardProvider(locale: string) {
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    redirect(wrongRoleTarget(user.role, locale));
  }
  if (!user.providerId) redirect(wrongRoleTarget(user.role, locale));
  return user;
}

// ---- createVehicle ----------------------------------------------------------

export async function createVehicle(
  locale: string,
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const user = await guardProvider(locale);

  const raw = {
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    branchId: formData.get('branchId') || undefined,
    make: formData.get('make') || undefined,
    model: formData.get('model') || undefined,
    year: formData.get('year') ? Number(formData.get('year')) : undefined,
    transmission: formData.get('transmission'),
    fuelType: formData.get('fuelType'),
    status: formData.get('status') || 'active',
    pricePerDay: Number(formData.get('pricePerDay')),
    seats: formData.get('seats') ? Number(formData.get('seats')) : undefined,
    imageUrl: formData.get('imageUrl') || undefined,
    description: formData.get('description') || undefined,
  };

  const parsed = vehicleCreateSchema.safeParse(raw);
  if (!parsed.success) return { error: 'invalid' };

  const { transmission, fuelType, status, ...rest } = parsed.data;

  // Verify category belongs to tenant
  const cat = await prisma.vehicleCategory.findFirst({
    where: { id: rest.categoryId, ...tenantScope(user) },
  });
  if (!cat) return { error: 'category_not_found' };

  if (rest.branchId) {
    const br = await prisma.branch.findFirst({
      where: { id: rest.branchId, ...tenantScope(user) },
    });
    if (!br) return { error: 'branch_not_found' };
  }

  await prisma.vehicle.create({
    data: {
      ...rest,
      providerId: user.providerId!,
      transmission: transmissionToDb(transmission) as 'AUTOMATIC' | 'MANUAL',
      fuelType: fuelTypeToDb(fuelType) as 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID',
      status: vehicleStatusToDb(status ?? 'active') as 'ACTIVE' | 'MAINTENANCE' | 'RETIRED',
    },
  });

  redirect(`/${locale}/dashboard/fleet`);
}

// ---- updateVehicle ----------------------------------------------------------

export async function updateVehicle(
  locale: string,
  id: string,
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const user = await guardProvider(locale);

  const raw: Record<string, unknown> = {};
  const name = formData.get('name');
  const categoryId = formData.get('categoryId');
  const branchId = formData.get('branchId');
  const make = formData.get('make');
  const model = formData.get('model');
  const yearRaw = formData.get('year');
  const transmission = formData.get('transmission');
  const fuelType = formData.get('fuelType');
  const status = formData.get('status');
  const pricePerDay = formData.get('pricePerDay');
  const seats = formData.get('seats');
  const imageUrl = formData.get('imageUrl');
  const description = formData.get('description');

  if (name) raw.name = name;
  if (categoryId) raw.categoryId = categoryId;
  if (branchId) raw.branchId = branchId;
  if (make) raw.make = make;
  if (model) raw.model = model;
  if (yearRaw) raw.year = Number(yearRaw);
  if (transmission) raw.transmission = transmission;
  if (fuelType) raw.fuelType = fuelType;
  if (status) raw.status = status;
  if (pricePerDay) raw.pricePerDay = Number(pricePerDay);
  if (seats) raw.seats = Number(seats);
  if (imageUrl) raw.imageUrl = imageUrl;
  if (description) raw.description = description;

  const parsed = vehicleUpdateSchema.safeParse(raw);
  if (!parsed.success) return { error: 'invalid' };

  type UpdateData = {
    name?: string; categoryId?: string; branchId?: string; make?: string; model?: string;
    year?: number; transmission?: 'AUTOMATIC' | 'MANUAL';
    fuelType?: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
    status?: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
    pricePerDay?: number; seats?: number; imageUrl?: string; description?: string;
  };

  const {
    transmission: tx, fuelType: ft, status: st,
    categoryId: newCat, ...rest
  } = parsed.data;

  if (newCat) {
    const cat = await prisma.vehicleCategory.findFirst({
      where: { id: newCat, ...tenantScope(user) },
    });
    if (!cat) return { error: 'category_not_found' };
  }

  const updateData: UpdateData = { ...rest };
  if (newCat) updateData.categoryId = newCat;
  if (tx) updateData.transmission = transmissionToDb(tx) as 'AUTOMATIC' | 'MANUAL';
  if (ft) updateData.fuelType = fuelTypeToDb(ft) as 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
  if (st) updateData.status = vehicleStatusToDb(st) as 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';

  const result = await prisma.vehicle.updateMany({
    where: { id, ...tenantScope(user) },
    data: updateData,
  });
  if (result.count === 0) return { error: 'not_found' };

  redirect(`/${locale}/dashboard/fleet`);
}

// ---- deleteVehicle ----------------------------------------------------------

export async function deleteVehicle(locale: string, id: string): Promise<void> {
  const user = await guardProvider(locale);
  await prisma.vehicle.deleteMany({ where: { id, ...tenantScope(user) } });
  redirect(`/${locale}/dashboard/fleet`);
}
