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
  ContractDTO,
  ContractSignInput,
  LoyaltyAccountDTO,
  LoyaltyEntryDTO,
  AddressDTO,
  AddressCreateInput,
  SupportTicketDTO,
  SupportTicketCreateInput,
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

export async function quoteBooking(
  req: BookingQuoteRequest,
  discountCode?: string,
): Promise<BookingQuote | null> {
  const body: BookingQuoteRequest & { discountCode?: string } = discountCode
    ? { ...req, discountCode }
    : req;
  const res = await authedFetch('/api/bookings/quote', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.ok ? ((await res.json()) as BookingQuote) : null;
}

export async function createBooking(
  req: BookingCreateRequest,
  discountCode?: string,
): Promise<BookingDTO | null> {
  const body: BookingCreateRequest & { discountCode?: string } = discountCode
    ? { ...req, discountCode }
    : req;
  const res = await authedFetch('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(body),
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

/** OTP error codes returned by the verify endpoint. */
export type OtpErrorCode =
  | 'not_found'
  | 'expired'
  | 'consumed'
  | 'locked'
  | 'invalid'
  | 'invalid_request';

export interface OtpVerifyResult {
  verified: true;
}

export interface OtpVerifyError {
  error: OtpErrorCode;
  message: string;
}

/**
 * Customer submits a 6-digit OTP to unlock the lockbox.
 * Returns { verified: true } on success, or an OtpVerifyError on 422/4xx.
 * IMPORTANT: the code is sent to the server but NEVER logged by this client.
 */
export async function verifyOtp(
  bookingId: string,
  code: string,
): Promise<OtpVerifyResult | OtpVerifyError> {
  const res = await authedFetch(`/api/bookings/${bookingId}/otp/verify`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  const json = (await res.json()) as OtpVerifyResult | OtpVerifyError;
  return json;
}

export interface SignContractResult {
  contract: ContractDTO;
  booking: BookingDTO;
}

/**
 * Customer signs the digital contract after OTP verification.
 * On success the booking transitions to 'picked-up'.
 * Returns null on unexpected non-2xx.
 */
export async function signContract(
  bookingId: string,
  input: ContractSignInput,
): Promise<SignContractResult | null> {
  const res = await authedFetch(`/api/bookings/${bookingId}/contract/sign`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.ok ? ((await res.json()) as SignContractResult) : null;
}

/**
 * Customer initiates a return for a picked-up booking.
 * Returns the updated BookingDTO (status: 'returned') or null on error.
 */
export async function returnVehicle(bookingId: string): Promise<BookingDTO | null> {
  const res = await authedFetch(`/api/bookings/${bookingId}/return`, {
    method: 'POST',
  });
  return res.ok ? ((await res.json()) as BookingDTO) : null;
}

/**
 * Re-book a past booking (completed/cancelled). Creates a new reserved booking
 * cloned from the source booking's vehicle/dates/plan.
 * Returns the new BookingDTO or null on error.
 */
export async function rebookBooking(bookingId: string): Promise<BookingDTO | null> {
  const res = await authedFetch(`/api/bookings/${bookingId}/rebook`, {
    method: 'POST',
  });
  return res.ok ? ((await res.json()) as BookingDTO) : null;
}

// ---- Loyalty ---------------------------------------------------------------

export interface LoyaltyData {
  account: LoyaltyAccountDTO;
  entries: LoyaltyEntryDTO[];
}

/**
 * Fetches the current customer's loyalty account + entry history.
 * Returns null if not found or on error.
 */
export async function getLoyalty(): Promise<LoyaltyData | null> {
  const res = await authedFetch('/api/loyalty');
  return res.ok ? ((await res.json()) as LoyaltyData) : null;
}

// ---- Saved Addresses -------------------------------------------------------

/** List all saved addresses for the current customer. */
export async function listAddresses(): Promise<AddressDTO[]> {
  const res = await authedFetch('/api/addresses');
  return res.ok ? ((await res.json()) as AddressDTO[]) : [];
}

/** Create a new saved address. */
export async function createAddress(input: AddressCreateInput): Promise<AddressDTO | null> {
  const res = await authedFetch('/api/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.ok ? ((await res.json()) as AddressDTO) : null;
}

/** Update an existing saved address. */
export async function updateAddress(
  id: string,
  input: Partial<AddressCreateInput>,
): Promise<AddressDTO | null> {
  const res = await authedFetch(`/api/addresses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return res.ok ? ((await res.json()) as AddressDTO) : null;
}

/** Delete a saved address. Returns true on success. */
export async function deleteAddress(id: string): Promise<boolean> {
  const res = await authedFetch(`/api/addresses/${id}`, { method: 'DELETE' });
  return res.ok;
}

// ---- Support Tickets -------------------------------------------------------

/** Create a new support ticket for the current customer. */
export async function createSupportTicket(
  input: SupportTicketCreateInput,
): Promise<SupportTicketDTO | null> {
  const res = await authedFetch('/api/support', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.ok ? ((await res.json()) as SupportTicketDTO) : null;
}

/** List support tickets for the current customer. */
export async function listSupportTickets(): Promise<SupportTicketDTO[]> {
  const res = await authedFetch('/api/support');
  return res.ok ? ((await res.json()) as SupportTicketDTO[]) : [];
}

// ---- Branding ---------------------------------------------------------------

export interface BrandingDTO {
  name: string;
  primary: string;
  primaryDark: string;
  logoUrl: string | null;
}

/**
 * Fetches the active provider's branding config.
 * Public endpoint — no auth token required.
 * Returns null on network error or non-2xx.
 */
export async function getBranding(): Promise<BrandingDTO | null> {
  try {
    const res = await fetch(`${BASE}/api/branding`, {
      headers: { 'content-type': 'application/json' },
    });
    return res.ok ? ((await res.json()) as BrandingDTO) : null;
  } catch {
    return null;
  }
}
