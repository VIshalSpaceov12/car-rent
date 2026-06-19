import { describe, it, expect } from 'vitest';
import { prisma } from './db';

describe('seed', () => {
  it('has one user per role, tenant-scoped correctly', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@demo.test' } });
    const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
    const staff = await prisma.user.findUnique({ where: { email: 'staff@demo.test' } });
    const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });

    expect(admin).not.toBeNull();
    expect(admin?.role).toBe('ADMIN');
    expect(admin?.providerId).toBeNull();

    expect(provider).not.toBeNull();
    expect(provider?.role).toBe('PROVIDER');
    expect(provider?.providerId).not.toBeNull();

    expect(staff).not.toBeNull();
    expect(staff?.role).toBe('STAFF');
    expect(staff?.providerId).not.toBeNull();

    expect(customer).not.toBeNull();
    expect(customer?.role).toBe('CUSTOMER');
    expect(customer?.providerId).toBeNull();
  });
});
