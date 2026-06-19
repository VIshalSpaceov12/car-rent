import { describe, it, expect } from 'vitest';
import { assertTransition, confirmAfterPayment, LifecycleError } from './lifecycle';

describe('assertTransition', () => {
  it('allows a legal chain: reserved->confirmed->vehicle-prepared->picked-up->returned->completed', () => {
    expect(() => assertTransition('reserved', 'confirmed', 'provider')).not.toThrow();
    expect(() => assertTransition('confirmed', 'vehicle-prepared', 'staff')).not.toThrow();
    expect(() => assertTransition('vehicle-prepared', 'picked-up', 'provider')).not.toThrow();
    expect(() => assertTransition('picked-up', 'returned', 'staff')).not.toThrow();
    expect(() => assertTransition('returned', 'completed', 'provider')).not.toThrow();
  });

  it('allows admin to drive any provider transition', () => {
    expect(() => assertTransition('reserved', 'confirmed', 'admin')).not.toThrow();
    expect(() => assertTransition('confirmed', 'vehicle-prepared', 'admin')).not.toThrow();
  });

  it('allows customer to cancel from reserved', () => {
    expect(() => assertTransition('reserved', 'cancelled', 'customer')).not.toThrow();
  });

  it('allows customer to cancel from confirmed', () => {
    expect(() => assertTransition('confirmed', 'cancelled', 'customer')).not.toThrow();
  });

  it('allows provider to reject from reserved', () => {
    expect(() => assertTransition('reserved', 'rejected', 'provider')).not.toThrow();
  });

  it('throws for illegal jump: reserved->completed', () => {
    expect(() => assertTransition('reserved', 'completed', 'provider')).toThrow(LifecycleError);
  });

  it('throws for illegal jump: reserved->picked-up', () => {
    expect(() => assertTransition('reserved', 'picked-up', 'provider')).toThrow(LifecycleError);
  });

  it('throws when wrong role: customer cannot confirm', () => {
    expect(() => assertTransition('reserved', 'confirmed', 'customer')).toThrow(LifecycleError);
  });

  it('throws when wrong role: customer cannot advance to vehicle-prepared', () => {
    expect(() => assertTransition('confirmed', 'vehicle-prepared', 'customer')).toThrow(LifecycleError);
  });

  it('throws when wrong role: customer cannot mark returned', () => {
    expect(() => assertTransition('picked-up', 'returned', 'customer')).toThrow(LifecycleError);
  });

  it('throws on transition from terminal state: completed->anything', () => {
    expect(() => assertTransition('completed', 'reserved', 'admin')).toThrow(LifecycleError);
  });

  it('throws on transition from terminal state: cancelled->anything', () => {
    expect(() => assertTransition('cancelled', 'reserved', 'admin')).toThrow(LifecycleError);
  });

  it('throws on transition from terminal state: rejected->anything', () => {
    expect(() => assertTransition('rejected', 'reserved', 'admin')).toThrow(LifecycleError);
  });

  it('throws when customer tries to cancel from vehicle-prepared (not allowed)', () => {
    expect(() => assertTransition('vehicle-prepared', 'cancelled', 'customer')).toThrow(LifecycleError);
  });
});

describe('confirmAfterPayment', () => {
  it('does not throw when booking is reserved', () => {
    expect(() => confirmAfterPayment('reserved')).not.toThrow();
  });

  it('throws LifecycleError when booking is already confirmed (idempotency guard)', () => {
    expect(() => confirmAfterPayment('confirmed')).toThrow(LifecycleError);
  });

  it('throws LifecycleError when booking is in a terminal cancelled state', () => {
    expect(() => confirmAfterPayment('cancelled')).toThrow(LifecycleError);
  });
});
