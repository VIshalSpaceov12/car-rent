import type {
  LoginResponse,
  SessionUser,
  VehicleDTO,
  VehicleBrowseQuery,
  BookingQuoteRequest,
  BookingQuote,
  BookingCreateRequest,
  BookingDTO,
  PaymentDTO,
  PaymentMethod,
} from '@car-rental/types';
import { getToken } from '@/auth/storage';

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await getToken();
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

export async function login(email: string, password: string): Promise<LoginResponse | null> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.ok ? ((await res.json()) as LoginResponse) : null;
}

export async function me(): Promise<SessionUser | null> {
  const res = await authedFetch('/api/auth/me');
  return res.ok ? ((await res.json()) as SessionUser) : null;
}

export async function listVehicles(query?: VehicleBrowseQuery): Promise<VehicleDTO[]> {
  let path = '/api/vehicles';
  if (query) {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.transmission) params.set('transmission', query.transmission);
    if (query.fuelType) params.set('fuelType', query.fuelType);
    if (query.minPrice !== undefined) params.set('minPrice', String(query.minPrice));
    if (query.maxPrice !== undefined) params.set('maxPrice', String(query.maxPrice));
    const qs = params.toString();
    if (qs) path = `${path}?${qs}`;
  }
  const res = await authedFetch(path);
  return res.ok ? ((await res.json()) as VehicleDTO[]) : [];
}

export async function getVehicle(id: string): Promise<VehicleDTO | null> {
  const res = await authedFetch(`/api/vehicles/${id}`);
  if (res.status === 404) return null;
  return res.ok ? ((await res.json()) as VehicleDTO) : null;
}

export async function quoteBooking(req: BookingQuoteRequest): Promise<BookingQuote | null> {
  const res = await authedFetch('/api/bookings/quote', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return res.ok ? ((await res.json()) as BookingQuote) : null;
}

export async function createBooking(req: BookingCreateRequest): Promise<BookingDTO | null> {
  const res = await authedFetch('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return res.ok ? ((await res.json()) as BookingDTO) : null;
}

export async function listBookings(): Promise<BookingDTO[]> {
  const res = await authedFetch('/api/bookings');
  return res.ok ? ((await res.json()) as BookingDTO[]) : [];
}

export interface PayBookingInput {
  method: PaymentMethod;
  /** MOCK ONLY — 'success' | 'fail'. Only relevant for method='card'. */
  cardOutcome?: 'success' | 'fail';
}

export interface PayBookingResult {
  payment: PaymentDTO;
  booking: BookingDTO;
}

/**
 * Initiates a (mock) payment for a booking.
 * Returns null on non-2xx (e.g. 409 already paid, 404 not found).
 */
export async function payBooking(
  bookingId: string,
  input: PayBookingInput,
): Promise<PayBookingResult | null> {
  const res = await authedFetch(`/api/bookings/${bookingId}/pay`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.ok ? ((await res.json()) as PayBookingResult) : null;
}
