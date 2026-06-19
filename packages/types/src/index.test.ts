import { describe, it, expect } from 'vitest';
import { USER_ROLES, BOOKING_STATUSES, loginRequestSchema, roleToDb, roleFromDb } from './index';

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
    expect(loginRequestSchema.safeParse({ email: 'a@b.c', password: 'x' }).success).toBe(true);
    expect(loginRequestSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });
});
