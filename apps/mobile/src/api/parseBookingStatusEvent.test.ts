import { describe, it, expect } from 'vitest';
import { parseBookingStatusEvent } from './parseBookingStatusEvent';

describe('parseBookingStatusEvent', () => {
  it('returns payload for valid JSON event data', () => {
    const raw = JSON.stringify({ bookingId: 'b1', status: 'confirmed', providerId: 'p1', customerId: 'c1' });
    expect(parseBookingStatusEvent(raw)).toEqual({ bookingId: 'b1', status: 'confirmed' });
  });

  it('returns null for invalid JSON', () => {
    expect(parseBookingStatusEvent('not-json')).toBeNull();
  });

  it('returns null when bookingId is missing', () => {
    const raw = JSON.stringify({ status: 'reserved' });
    expect(parseBookingStatusEvent(raw)).toBeNull();
  });

  it('returns null when status is missing', () => {
    const raw = JSON.stringify({ bookingId: 'b1' });
    expect(parseBookingStatusEvent(raw)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseBookingStatusEvent('')).toBeNull();
  });

  it('ignores extra fields and returns only bookingId + status', () => {
    const raw = JSON.stringify({ bookingId: 'b2', status: 'picked-up', extra: 'ignored' });
    const result = parseBookingStatusEvent(raw);
    expect(result).toEqual({ bookingId: 'b2', status: 'picked-up' });
  });

  it('returns null for non-string bookingId', () => {
    const raw = JSON.stringify({ bookingId: 42, status: 'reserved' });
    expect(parseBookingStatusEvent(raw)).toBeNull();
  });

  it('returns null for unknown/invalid status value', () => {
    const raw = JSON.stringify({ bookingId: 'b1', status: 'flying' });
    expect(parseBookingStatusEvent(raw)).toBeNull();
  });
});
