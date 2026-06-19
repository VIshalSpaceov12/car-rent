import { z } from 'zod';

export const USER_ROLES = ['customer', 'provider', 'staff', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const BOOKING_STATUSES = [
  'reserved', 'confirmed', 'vehicle-prepared', 'picked-up',
  'returned', 'completed', 'rejected', 'cancelled',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const RENTAL_PLANS = ['daily', 'weekly', 'monthly', 'long-term'] as const;
export type RentalPlan = (typeof RENTAL_PLANS)[number];

export const PAYMENT_METHODS = ['card', 'cash-on-delivery'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ---- fleet & catalog enums (wire = lowercase/kebab; db = UPPER_SNAKE) ----
export const TRANSMISSIONS = ['automatic', 'manual'] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const FUEL_TYPES = ['petrol', 'diesel', 'electric', 'hybrid'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const VEHICLE_STATUSES = ['active', 'maintenance', 'retired'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

// ---- wire ⇄ db mappers (db = UPPER_SNAKE) -------------------------------
const toDb = (s: string) => s.toUpperCase().replace(/-/g, '_');
const fromDb = (s: string) => s.toLowerCase().replace(/_/g, '-');

export const roleToDb = (r: UserRole): string | undefined =>
  (USER_ROLES as readonly string[]).includes(r) ? toDb(r) : undefined;
export const roleFromDb = (r: string): UserRole => fromDb(r) as UserRole;
export const bookingStatusToDb = (s: BookingStatus) => toDb(s);
export const bookingStatusFromDb = (s: string) => fromDb(s) as BookingStatus;
export const transmissionToDb = (t: Transmission) => toDb(t);
export const transmissionFromDb = (t: string): Transmission => fromDb(t) as Transmission;
export const fuelTypeToDb = (f: FuelType) => toDb(f);
export const fuelTypeFromDb = (f: string): FuelType => fromDb(f) as FuelType;
export const vehicleStatusToDb = (s: VehicleStatus) => toDb(s);
export const vehicleStatusFromDb = (s: string): VehicleStatus => fromDb(s) as VehicleStatus;

// ---- DTOs ---------------------------------------------------------------
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
  providerId: z.string().nullable(),
  locale: z.enum(LOCALES),
  name: z.string(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export interface LoginResponse { token: string; user: SessionUser }
export interface HealthResponse { status: 'ok'; time: string }

// ---- VehicleCategory DTO + schema ----------------------------------------
export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export interface VehicleCategoryDTO {
  id: string;
  providerId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Branch DTO + schema --------------------------------------------------
export const branchCreateSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1),
  phone: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
export type BranchCreateInput = z.infer<typeof branchCreateSchema>;

export interface BranchDTO {
  id: string;
  providerId: string;
  name: string;
  address: string;
  phone?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  updatedAt: string;
}

// ---- Vehicle DTO + schemas -----------------------------------------------
export const vehicleCreateSchema = z.object({
  categoryId: z.string().min(1),
  branchId: z.string().optional(),
  name: z.string().min(1).max(150),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  transmission: z.enum(TRANSMISSIONS),
  fuelType: z.enum(FUEL_TYPES),
  status: z.enum(VEHICLE_STATUSES).default('active'),
  pricePerDay: z.number().positive(),
  seats: z.number().int().positive().optional(),
  imageUrl: z.string().url().optional(),
  description: z.string().optional(),
});
export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>;

export const vehicleUpdateSchema = vehicleCreateSchema.partial();
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>;

export interface VehicleDTO {
  id: string;
  providerId: string;
  categoryId: string;
  branchId?: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  transmission: Transmission;
  fuelType: FuelType;
  status: VehicleStatus;
  pricePerDay: number;
  seats?: number;
  imageUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- VehicleBrowseQuery --------------------------------------------------
export interface VehicleBrowseQuery {
  categoryId?: string;
  transmission?: Transmission;
  fuelType?: FuelType;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
}
