import { describe, it, expect } from 'vitest';
import {
  USER_ROLES, BOOKING_STATUSES, loginRequestSchema, roleToDb, roleFromDb,
  TRANSMISSIONS, FUEL_TYPES, VEHICLE_STATUSES,
  transmissionToDb, transmissionFromDb,
  fuelTypeToDb, fuelTypeFromDb,
  vehicleStatusToDb, vehicleStatusFromDb,
  vehicleCreateSchema, categoryCreateSchema,
} from './index';

describe('@car-rental/types', () => {
  it('exposes the four roles', () => {
    expect(USER_ROLES).toEqual(['customer', 'provider', 'staff', 'admin']);
  });
  it('exposes the full booking lifecycle in order', () => {
    expect(BOOKING_STATUSES).toEqual([
      'reserved', 'confirmed', 'vehicle-prepared', 'picked-up',
      'returned', 'completed', 'rejected', 'cancelled',
    ]);
  });
  it('maps wire role ⇄ db role', () => {
    expect(roleToDb('vehicle-prepared' as never)).toBeUndefined(); // not a role
    expect(roleToDb('provider')).toBe('PROVIDER');
    expect(roleFromDb('PROVIDER')).toBe('provider');
  });
  it('validates a login request', () => {
    expect(loginRequestSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginRequestSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });

  it('exposes Transmission enum values', () => {
    expect(TRANSMISSIONS).toEqual(['automatic', 'manual']);
  });
  it('exposes FuelType enum values', () => {
    expect(FUEL_TYPES).toEqual(['petrol', 'diesel', 'electric', 'hybrid']);
  });
  it('exposes VehicleStatus enum values', () => {
    expect(VEHICLE_STATUSES).toEqual(['active', 'maintenance', 'retired']);
  });
  it('maps Transmission wire ⇄ db', () => {
    expect(transmissionToDb('automatic')).toBe('AUTOMATIC');
    expect(transmissionFromDb('MANUAL')).toBe('manual');
  });
  it('maps FuelType wire ⇄ db', () => {
    expect(fuelTypeToDb('electric')).toBe('ELECTRIC');
    expect(fuelTypeFromDb('PETROL')).toBe('petrol');
  });
  it('maps VehicleStatus wire ⇄ db', () => {
    expect(vehicleStatusToDb('maintenance')).toBe('MAINTENANCE');
    expect(vehicleStatusFromDb('RETIRED')).toBe('retired');
  });
  it('parses a valid vehicleCreateSchema', () => {
    const result = vehicleCreateSchema.safeParse({
      categoryId: 'cat1',
      name: 'Toyota Corolla',
      make: 'Toyota',
      model: 'Corolla',
      year: 2022,
      transmission: 'automatic',
      fuelType: 'petrol',
      pricePerDay: 45.99,
      seats: 5,
    });
    expect(result.success).toBe(true);
  });
  it('rejects vehicleCreateSchema with invalid fuelType', () => {
    const result = vehicleCreateSchema.safeParse({
      categoryId: 'cat1',
      name: 'Mystery Car',
      transmission: 'automatic',
      fuelType: 'nuclear',
      pricePerDay: 100,
    });
    expect(result.success).toBe(false);
  });
  it('parses a valid categoryCreateSchema', () => {
    const result = categoryCreateSchema.safeParse({ name: 'Economy', slug: 'economy' });
    expect(result.success).toBe(true);
  });
  it('rejects categoryCreateSchema with invalid slug', () => {
    const result = categoryCreateSchema.safeParse({ name: 'Economy', slug: 'Economy Cars!' });
    expect(result.success).toBe(false);
  });
});
