/**
 * Integration tests for GET and PATCH /api/admin/settings
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';
import { signJwt } from '@/server/auth/jwt';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: async () => ({ get: () => undefined }),
}));

import { headers } from 'next/headers';
import { GET, PATCH } from './route';

function mockAuth(token: string) {
  vi.mocked(headers).mockResolvedValue({
    get: (name: string) => (name === 'authorization' ? `Bearer ${token}` : null),
  } as never);
}
function mockNoAuth() {
  vi.mocked(headers).mockResolvedValue({ get: () => null } as never);
}
function req(method: string, body?: unknown) {
  return new Request('http://localhost/api/admin/settings', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

let adminToken: string;
let providerToken: string;
let customerToken: string;
let originalSettings: { platformName: string; supportEmail: string };

beforeAll(async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@demo.test' } });
  if (!admin) throw new Error('admin@demo.test not seeded');
  adminToken = signJwt(admin.id);

  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);

  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  // Save original settings to restore after tests
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  if (settings) {
    originalSettings = { platformName: settings.platformName, supportEmail: settings.supportEmail };
  } else {
    originalSettings = { platformName: 'Platform', supportEmail: 'support@platform.test' };
  }
});

afterAll(async () => {
  // Restore original settings
  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: originalSettings,
    create: { id: 'singleton', ...originalSettings, defaultLocale: 'EN' },
  });
  await prisma.$disconnect();
});

describe('Authorization — /api/admin/settings', () => {
  it('GET rejects unauthenticated (401)', async () => {
    mockNoAuth();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('GET rejects customer (403)', async () => {
    mockAuth(customerToken);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('GET rejects provider (403)', async () => {
    mockAuth(providerToken);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('PATCH rejects customer (403)', async () => {
    mockAuth(customerToken);
    const res = await PATCH(req('PATCH', { platformName: 'Hacked' }));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/settings', () => {
  it('returns singleton platform settings', async () => {
    mockAuth(adminToken);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.platformName).toBeTruthy();
    expect(body.supportEmail).toMatch(/@/);
    expect(['en', 'ar']).toContain(body.defaultLocale);
  });
});

describe('PATCH /api/admin/settings', () => {
  it('returns 400 on invalid body', async () => {
    mockAuth(adminToken);
    const res = await PATCH(req('PATCH', { supportEmail: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('updates platformName and returns updated settings', async () => {
    mockAuth(adminToken);
    const newName = `Test Platform ${Date.now()}`;
    const res = await PATCH(req('PATCH', { platformName: newName }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.platformName).toBe(newName);
    expect(body.updatedAt).toBeTruthy();
  });

  it('partial update only changes specified fields', async () => {
    mockAuth(adminToken);
    // Get current email first
    const getRes = await GET();
    const current = await getRes.json();
    const currentEmail = current.supportEmail;

    mockAuth(adminToken);
    const res = await PATCH(req('PATCH', { platformName: 'Partial Update Test' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.platformName).toBe('Partial Update Test');
    expect(body.supportEmail).toBe(currentEmail); // unchanged
  });
});
