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

// ---- Booking schemas + DTOs ----------------------------------------------

export const bookingQuoteRequestSchema = z.object({
  vehicleId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO date YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO date YYYY-MM-DD'),
  plan: z.enum(RENTAL_PLANS),
  pickupBranchId: z.string().optional(),
  dropoffBranchId: z.string().optional(),
});
export type BookingQuoteRequest = z.infer<typeof bookingQuoteRequestSchema>;

// BookingCreateRequest = same fields as quote request
export const bookingCreateRequestSchema = bookingQuoteRequestSchema;
export type BookingCreateRequest = z.infer<typeof bookingCreateRequestSchema>;

export interface BookingQuote {
  days: number;
  baseRatePerDay: number;
  planMultiplier: number;
  seasonalMultiplier: number;
  subtotal: number;
  taxRatePct: number;
  taxAmount: number;
  serviceCharge: number;
  total: number;
  currency: string;
  /** Present when a discountCode was supplied. false means the code was invalid/expired/wrong-tenant. */
  discountApplied?: boolean;
}

export interface BookingDTO {
  id: string;
  status: BookingStatus;
  vehicle: { id: string; name: string };
  startDate: string;
  endDate: string;
  plan: RentalPlan;
  pickupBranchName?: string;
  dropoffBranchName?: string;
  baseAmount: number;
  taxAmount: number;
  serviceCharge: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
  /** Present when the booking has an associated payment record */
  payment?: PaymentDTO;
}

// ---- Payment mappers ----------------------------------------------------
export const paymentMethodToDb = (m: PaymentMethod): string => toDb(m);
export const paymentMethodFromDb = (m: string): PaymentMethod => fromDb(m) as PaymentMethod;
export const paymentStatusToDb = (s: PaymentStatus): string => toDb(s);
export const paymentStatusFromDb = (s: string): PaymentStatus => fromDb(s) as PaymentStatus;

// ---- Payment DTO + schema ------------------------------------------------
export interface PaymentDTO {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
}

/**
 * Schema for initiating a payment. `cardOutcome` is a MOCK-ONLY toggle that
 * drives the fake card result — it is never persisted and must NOT be sent in
 * production. Omit it (or pass 'success') for a happy-path card, 'fail' to
 * simulate a declined card.
 */
export const payInitiateSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  /** MOCK ONLY — controls fake card result; ignored for cash-on-delivery */
  cardOutcome: z.enum(['success', 'fail']).optional().default('success'),
});
export type PayInitiateInput = z.infer<typeof payInitiateSchema>;

// ---- ReturnCondition enum -----------------------------------------------
export const RETURN_CONDITIONS = ['clean', 'minor-damage', 'major-damage'] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export const returnConditionToDb = (c: ReturnCondition): string => toDb(c);
export const returnConditionFromDb = (c: string): ReturnCondition => fromDb(c) as ReturnCondition;

// ---- OTP / Contract / Inspection DTOs + schemas -------------------------

/**
 * Booking-bound OTP status — NEVER contains the plaintext code.
 */
export interface OtpStatusDTO {
  issued: boolean;
  expiresAt: string | null;
  consumedAt: string | null;
  attempts: number;
}

/**
 * One-time response from the issue endpoint — the only time plaintext leaves server.
 * NEVER stored or logged.
 */
export interface IssuedOtpDTO {
  code: string;
}

/** Customer submits a 6-digit code to verify/unlock the lockbox. */
export const otpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

export interface ContractDTO {
  id: string;
  bookingId: string;
  signedAt: string | null;
  signatureName: string | null;
  termsVersion: string;
}

export const contractSignSchema = z.object({
  signatureName: z.string().min(1, 'Signature name is required'),
  agree: z.literal(true, { errorMap: () => ({ message: 'You must agree to the terms' }) }),
});
export type ContractSignInput = z.infer<typeof contractSignSchema>;

export interface InspectionDTO {
  id: string;
  bookingId: string;
  condition: ReturnCondition;
  notes: string | null;
  inspectedAt: string;
}

export const inspectionSchema = z.object({
  condition: z.enum(RETURN_CONDITIONS),
  notes: z.string().optional(),
});
export type InspectionInput = z.infer<typeof inspectionSchema>;

// ---- Engagement / Ops enums ---------------------------------------------

export const SUPPORT_STATUSES = ['open', 'resolved'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const DISCOUNT_KINDS = ['percent', 'fixed'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

// wire ⇄ db mappers for new enums
export const supportStatusToDb = (s: SupportStatus): string => toDb(s);
export const supportStatusFromDb = (s: string): SupportStatus => fromDb(s) as SupportStatus;
export const discountKindToDb = (k: DiscountKind): string => toDb(k);
export const discountKindFromDb = (k: string): DiscountKind => fromDb(k) as DiscountKind;

// ---- LoyaltyAccount + LoyaltyEntry DTOs ---------------------------------
export interface LoyaltyAccountDTO {
  id: string;
  userId: string;
  points: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyEntryDTO {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  bookingId?: string;
  createdAt: string;
}

// ---- Address DTO + schema ------------------------------------------------
export const addressCreateSchema = z.object({
  label: z.string().min(1).max(100),
  line1: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  isDefault: z.boolean().optional().default(false),
});
export type AddressCreateInput = z.infer<typeof addressCreateSchema>;

export interface AddressDTO {
  id: string;
  userId: string;
  label: string;
  line1: string;
  city: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
}

// ---- SupportTicket DTO + schema ------------------------------------------
export const supportTicketCreateSchema = z.object({
  subject: z.string().min(1).max(255),
  body: z.string().min(1),
});
export type SupportTicketCreateInput = z.infer<typeof supportTicketCreateSchema>;

export interface SupportTicketDTO {
  id: string;
  providerId: string;
  userId: string;
  subject: string;
  body: string;
  status: SupportStatus;
  response?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- DiscountCode DTO + schema -------------------------------------------
export const discountCreateSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric'),
  kind: z.enum(DISCOUNT_KINDS),
  value: z.number().positive(),
  active: z.boolean().default(true),
  expiresAt: z.string().datetime().optional(),
});
export type DiscountCreateInput = z.infer<typeof discountCreateSchema>;

export interface DiscountCodeDTO {
  id: string;
  providerId: string;
  code: string;
  kind: DiscountKind;
  value: number;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
}

// ---- MaintenanceRecord DTO + schema --------------------------------------
export const maintenanceCreateSchema = z.object({
  vehicleId: z.string().min(1),
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ISO date YYYY-MM-DD'),
  cost: z.number().nonnegative().optional(),
});
export type MaintenanceCreateInput = z.infer<typeof maintenanceCreateSchema>;

export interface MaintenanceRecordDTO {
  id: string;
  providerId: string;
  vehicleId: string;
  description: string;
  date: string;
  cost?: number;
  createdAt: string;
}

// ---- Admin / platform-level types ----------------------------------------

export const PROVIDER_STATUSES = ['active', 'suspended', 'pending'] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

/** DTO returned by admin list/get provider endpoints */
export interface ProviderAdminDTO {
  id: string;
  name: string;
  slug: string;
  status: ProviderStatus;
  defaultLocale: Locale;
  colors: Record<string, string>;
  createdAt: string;
  /** Optional aggregated counts — present when the endpoint includes them */
  counts?: {
    users: number;
    vehicles: number;
    bookings: number;
  };
}

/**
 * Schema for onboarding a new provider (tenant) with its owner user.
 * Admin-only action — slug uniqueness enforced at the service layer.
 */
export const providerOnboardSchema = z.object({
  name: z.string().min(1).max(150),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex color'),
  primaryDarkColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex color').optional(),
  defaultLocale: z.enum(LOCALES).optional().default('en'),
  ownerName: z.string().min(1).max(150),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
});
export type ProviderOnboardInput = z.infer<typeof providerOnboardSchema>;

/** Schema for updating a provider's status (approve / suspend / pending). */
export const providerStatusSchema = z.object({
  status: z.enum(PROVIDER_STATUSES),
});
export type ProviderStatusInput = z.infer<typeof providerStatusSchema>;

/** Schema for the singleton platform-level settings (admin-only). */
export const platformSettingsSchema = z.object({
  platformName: z.string().min(1).max(150),
  supportEmail: z.string().email(),
  defaultLocale: z.enum(LOCALES).optional().default('en'),
});
export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;

/** DTO for platform settings */
export interface PlatformSettingsDTO {
  platformName: string;
  supportEmail: string;
  defaultLocale: Locale;
  updatedAt: string;
}

// ---- Booking lifecycle transition map ------------------------------------
// Maps current status -> list of { next, allowedRoles }
// provider/staff drive operational transitions; customer can only cancel from early states
export const BOOKING_TRANSITIONS: Record<
  BookingStatus,
  Array<{ next: BookingStatus; allowedRoles: Array<'provider' | 'staff' | 'customer' | 'admin'> }>
> = {
  reserved: [
    { next: 'confirmed',  allowedRoles: ['provider', 'staff', 'admin'] },
    { next: 'rejected',   allowedRoles: ['provider', 'staff', 'admin'] },
    { next: 'cancelled',  allowedRoles: ['customer', 'provider', 'staff', 'admin'] },
  ],
  confirmed: [
    { next: 'vehicle-prepared', allowedRoles: ['provider', 'staff', 'admin'] },
    { next: 'cancelled',        allowedRoles: ['customer', 'provider', 'staff', 'admin'] },
  ],
  'vehicle-prepared': [
    { next: 'picked-up', allowedRoles: ['provider', 'staff', 'admin'] },
  ],
  'picked-up': [
    { next: 'returned', allowedRoles: ['provider', 'staff', 'admin'] },
  ],
  returned: [
    { next: 'completed', allowedRoles: ['provider', 'staff', 'admin'] },
  ],
  completed: [],
  rejected: [],
  cancelled: [],
};
