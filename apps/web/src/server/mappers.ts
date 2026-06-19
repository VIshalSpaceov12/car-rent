import 'server-only';
import {
  transmissionFromDb,
  fuelTypeFromDb,
  vehicleStatusFromDb,
  bookingStatusFromDb,
  type VehicleDTO,
  type VehicleCategoryDTO,
  type BranchDTO,
  type BookingDTO,
} from '@car-rental/types';

type PrismaVehicle = {
  id: string;
  providerId: string;
  categoryId: string;
  branchId: string | null;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  transmission: string;
  fuelType: string;
  status: string;
  pricePerDay: { toString(): string } | number;
  seats: number | null;
  imageUrl: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaCategory = {
  id: string;
  providerId: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaBranch = {
  id: string;
  providerId: string;
  name: string;
  address: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export function vehicleToDTO(v: PrismaVehicle): VehicleDTO {
  const dto: VehicleDTO = {
    id: v.id,
    providerId: v.providerId,
    categoryId: v.categoryId,
    name: v.name,
    transmission: transmissionFromDb(v.transmission),
    fuelType: fuelTypeFromDb(v.fuelType),
    status: vehicleStatusFromDb(v.status),
    pricePerDay: Number(v.pricePerDay),
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
  if (v.branchId !== null) dto.branchId = v.branchId;
  if (v.make !== null) dto.make = v.make;
  if (v.model !== null) dto.model = v.model;
  if (v.year !== null) dto.year = v.year;
  if (v.seats !== null) dto.seats = v.seats;
  if (v.imageUrl !== null) dto.imageUrl = v.imageUrl;
  if (v.description !== null) dto.description = v.description;
  return dto;
}

export function categoryToDTO(c: PrismaCategory): VehicleCategoryDTO {
  return {
    id: c.id,
    providerId: c.providerId,
    name: c.name,
    slug: c.slug,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function branchToDTO(b: PrismaBranch): BranchDTO {
  const dto: BranchDTO = {
    id: b.id,
    providerId: b.providerId,
    name: b.name,
    address: b.address,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
  if (b.phone !== null) dto.phone = b.phone;
  if (b.lat !== null) dto.lat = b.lat;
  if (b.lng !== null) dto.lng = b.lng;
  return dto;
}

type PrismaBooking = {
  id: string;
  status: string;
  vehicleId: string;
  startDate: Date;
  endDate: Date;
  plan: string;
  baseAmount: { toString(): string } | number;
  taxAmount: { toString(): string } | number;
  serviceCharge: { toString(): string } | number;
  totalAmount: { toString(): string } | number;
  currency: string;
  createdAt: Date;
  vehicle: { id: string; name: string };
  pickupBranch?: { name: string } | null;
  dropoffBranch?: { name: string } | null;
};

export function bookingToDTO(b: PrismaBooking): BookingDTO {
  const dto: BookingDTO = {
    id: b.id,
    status: bookingStatusFromDb(b.status),
    vehicle: { id: b.vehicle.id, name: b.vehicle.name },
    startDate: b.startDate.toISOString().slice(0, 10),
    endDate: b.endDate.toISOString().slice(0, 10),
    plan: b.plan.toLowerCase().replace(/_/g, '-') as BookingDTO['plan'],
    baseAmount: Number(b.baseAmount),
    taxAmount: Number(b.taxAmount),
    serviceCharge: Number(b.serviceCharge),
    totalAmount: Number(b.totalAmount),
    currency: b.currency,
    createdAt: b.createdAt.toISOString(),
  };
  if (b.pickupBranch) dto.pickupBranchName = b.pickupBranch.name;
  if (b.dropoffBranch) dto.dropoffBranchName = b.dropoffBranch.name;
  return dto;
}
