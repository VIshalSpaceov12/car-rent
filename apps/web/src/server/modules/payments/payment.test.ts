import { describe, it, expect } from 'vitest';
import { resolveOutcome } from './payment';

describe('resolveOutcome', () => {
  it('card success → paid and confirms booking', () => {
    const result = resolveOutcome('card', 'success');
    expect(result.paymentStatus).toBe('paid');
    expect(result.confirmsBooking).toBe(true);
  });

  it('card success (default) → paid and confirms booking', () => {
    const result = resolveOutcome('card');
    expect(result.paymentStatus).toBe('paid');
    expect(result.confirmsBooking).toBe(true);
  });

  it('card fail → failed and does NOT confirm booking', () => {
    const result = resolveOutcome('card', 'fail');
    expect(result.paymentStatus).toBe('failed');
    expect(result.confirmsBooking).toBe(false);
  });

  it('cash-on-delivery → pending and confirms booking', () => {
    const result = resolveOutcome('cash-on-delivery');
    expect(result.paymentStatus).toBe('pending');
    expect(result.confirmsBooking).toBe(true);
  });

  it('cash-on-delivery ignores cardOutcome → always pending+confirms', () => {
    const result = resolveOutcome('cash-on-delivery', 'fail');
    expect(result.paymentStatus).toBe('pending');
    expect(result.confirmsBooking).toBe(true);
  });
});
