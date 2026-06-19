import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { signJwt, verifyJwt } from './jwt';
import { requireRole, tenantScope } from './dal';
import type { SessionUser } from '@car-rental/types';

const provider: SessionUser = { id: 'u1', email: 'p@x.c', role: 'provider', providerId: 'prov1', locale: 'en', name: 'P' };
const admin: SessionUser = { ...provider, id: 'u2', role: 'admin', providerId: null };

describe('auth primitives', () => {
  it('hashes and verifies a password', async () => {
    const h = await hashPassword('Password123!');
    expect(await verifyPassword('Password123!', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });
  it('signs and verifies a JWT round-trip', () => {
    const token = signJwt('u1');
    expect(verifyJwt(token)?.userId).toBe('u1');
    expect(verifyJwt('garbage')).toBeNull();
  });
  it('requireRole allows listed roles, throws otherwise', () => {
    expect(() => requireRole(provider, 'provider', 'staff')).not.toThrow();
    expect(() => requireRole(provider, 'admin')).toThrow();
  });
  it('tenantScope pins providers to their tenant, admin unscoped', () => {
    expect(tenantScope(provider)).toEqual({ providerId: 'prov1' });
    expect(tenantScope(admin)).toEqual({});
  });
});
