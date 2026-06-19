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

// ---- wire ⇄ db mappers (db = UPPER_SNAKE) -------------------------------
const toDb = (s: string) => s.toUpperCase().replace(/-/g, '_');
const fromDb = (s: string) => s.toLowerCase().replace(/_/g, '-');

export const roleToDb = (r: UserRole): string | undefined =>
  (USER_ROLES as readonly string[]).includes(r) ? toDb(r) : undefined;
export const roleFromDb = (r: string): UserRole => fromDb(r) as UserRole;
export const bookingStatusToDb = (s: BookingStatus) => toDb(s);
export const bookingStatusFromDb = (s: string) => fromDb(s) as BookingStatus;

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
