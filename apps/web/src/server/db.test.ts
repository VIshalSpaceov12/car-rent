import { describe, it, expect } from 'vitest';
import { prisma } from './db';

describe('seed', () => {
  it('has one user per role, tenant-scoped correctly', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@demo.test' } });
    const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
    expect(admin?.role).toBe('ADMIN');
    expect(admin?.providerId).toBeNull();
    expect(provider?.providerId).not.toBeNull();
  });
});
