import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';
import { signJwt } from '@/server/auth/jwt';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: async () => ({ get: () => undefined }),
}));

import { headers } from 'next/headers';

function mockAuth(token: string) {
  vi.mocked(headers).mockResolvedValue({
    get: (name: string) => (name === 'authorization' ? `Bearer ${token}` : null),
  } as never);
}
function mockNoAuth() {
  vi.mocked(headers).mockResolvedValue({ get: () => null } as never);
}

let providerToken: string;
let staffToken: string;
let customerToken: string;
let otherProviderToken: string;

beforeAll(async () => {
  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);

  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  // Create an isolated other provider for cross-tenant test
  const hash = await (await import('bcrypt')).hash('Password123!', 10);
  let otherProviderRecord = await prisma.provider.findUnique({ where: { slug: 'branding-other-test' } });
  if (!otherProviderRecord) {
    otherProviderRecord = await prisma.provider.create({
      data: { name: 'Branding Other', slug: 'branding-other-test', colors: { primary: '#111111', primaryDark: '#222222' } },
    });
  }
  let otherProviderUser = await prisma.user.findUnique({ where: { email: 'branding-other@test.test' } });
  if (!otherProviderUser) {
    otherProviderUser = await prisma.user.create({
      data: {
        email: 'branding-other@test.test', name: 'Branding Other',
        role: 'PROVIDER', passwordHash: hash, providerId: otherProviderRecord.id,
      },
    });
  }
  otherProviderToken = signJwt(otherProviderUser.id);

  // Create staff user for the main provider
  const mainProvider = await prisma.provider.findUnique({ where: { slug: 'drivehub' } });
  if (!mainProvider) throw new Error('drivehub not seeded');
  let staffUser = await prisma.user.findUnique({ where: { email: 'branding-staff@test.test' } });
  if (!staffUser) {
    staffUser = await prisma.user.create({
      data: {
        email: 'branding-staff@test.test', name: 'Branding Staff',
        role: 'STAFF', passwordHash: hash, providerId: mainProvider.id,
      },
    });
  }
  staffToken = signJwt(staffUser.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

import { PATCH } from './route';

describe('PATCH /api/provider/branding', () => {
  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const req = new Request('http://localhost/api/provider/branding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ primary: '#FF0000', primaryDark: '#CC0000' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 for customer role', async () => {
    mockAuth(customerToken);
    const req = new Request('http://localhost/api/provider/branding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ primary: '#FF0000', primaryDark: '#CC0000' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid hex color', async () => {
    mockAuth(providerToken);
    const req = new Request('http://localhost/api/provider/branding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ primary: 'not-a-hex', primaryDark: '#CC0000' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('invalid_request');
  });

  it('updates own tenant colors', async () => {
    mockAuth(providerToken);
    const newPrimary = '#AA1234';
    const newDark = '#881000';
    const req = new Request('http://localhost/api/provider/branding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ primary: newPrimary, primaryDark: newDark }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { colors: { primary: string; primaryDark: string } };
    expect(body.colors.primary).toBe(newPrimary);
    expect(body.colors.primaryDark).toBe(newDark);

    // Restore original colors
    const mainProvider = await prisma.provider.findUnique({ where: { slug: 'drivehub' } });
    if (mainProvider) {
      await prisma.provider.update({
        where: { id: mainProvider.id },
        data: { colors: { primary: '#F97316', primaryDark: '#EA580C' } },
      });
    }
  });

  it('allows staff to update own tenant colors', async () => {
    mockAuth(staffToken);
    const req = new Request('http://localhost/api/provider/branding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ primary: '#F97316', primaryDark: '#EA580C' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });

  it('cannot update another provider tenant — uses session providerId only', async () => {
    // Even if we tried to pass another provider's id in the body, the route ignores it
    // and uses session-scoped providerId. Here otherProviderToken updates their OWN tenant.
    mockAuth(otherProviderToken);
    const req = new Request('http://localhost/api/provider/branding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ primary: '#0000FF', primaryDark: '#0000AA' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { colors: { primary: string } };
    // Updated their OWN provider, not drivehub
    expect(body.colors.primary).toBe('#0000FF');

    // Verify drivehub was NOT changed
    const drivehub = await prisma.provider.findUnique({ where: { slug: 'drivehub' }, select: { colors: true } });
    const drivehubColors = drivehub?.colors as { primary?: string } | null;
    expect(drivehubColors?.primary).toBe('#F97316');
  });
});
