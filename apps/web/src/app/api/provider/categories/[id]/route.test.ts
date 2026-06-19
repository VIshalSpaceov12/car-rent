import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';
import { signJwt } from '@/server/auth/jwt';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
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
let providerProviderId: string;
let otherProviderToken: string;
let otherProviderProviderId: string;
let categoryId: string;

beforeAll(async () => {
  const providerUser = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!providerUser) throw new Error('provider@demo.test not found — run npm run db:seed');
  providerToken = signJwt(providerUser.id);
  providerProviderId = providerUser.providerId!;

  // Create a category to operate on
  const cat = await prisma.vehicleCategory.create({
    data: {
      name: 'ID Route Test Category',
      slug: `test-cat-id-route-${Date.now()}`,
      providerId: providerProviderId,
    },
  });
  categoryId = cat.id;

  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('Password123!', 10);
  const otherProvider = await prisma.provider.upsert({
    where: { slug: 'test-other-cat-id' },
    update: {},
    create: {
      name: 'Other Category ID Provider',
      slug: 'test-other-cat-id',
      colors: { primary: 'black' },
    },
  });
  otherProviderProviderId = otherProvider.id;

  const otherUser = await prisma.user.upsert({
    where: { email: 'other-cat-id@test-isolation.test' },
    update: {},
    create: {
      email: 'other-cat-id@test-isolation.test',
      name: 'Other Cat ID User',
      role: 'PROVIDER',
      passwordHash: hash,
      providerId: otherProvider.id,
    },
  });
  otherProviderToken = signJwt(otherUser.id);
});

afterAll(async () => {
  await prisma.vehicleCategory.deleteMany({ where: { id: categoryId } }).catch(() => {});
  await prisma.vehicleCategory.deleteMany({ where: { providerId: otherProviderProviderId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: 'other-cat-id@test-isolation.test' } }).catch(() => {});
  await prisma.provider.delete({ where: { slug: 'test-other-cat-id' } }).catch(() => {});
  await prisma.$disconnect();
});

import { PATCH, DELETE } from './route';

describe('PATCH /api/provider/categories/[id]', () => {
  it('(a) cross-tenant PATCH returns 404 and does not mutate the row', async () => {
    mockAuth(otherProviderToken);
    const req = new Request(`http://localhost/api/provider/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Cross-Tenant Hack' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: categoryId }) });
    expect(res.status).toBe(404);

    const dbCat = await prisma.vehicleCategory.findUnique({ where: { id: categoryId } });
    expect(dbCat?.name).toBe('ID Route Test Category');
  });

  it('(c) successful PATCH updates only the session tenant\'s row', async () => {
    mockAuth(providerToken);
    const req = new Request(`http://localhost/api/provider/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Category Name' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: categoryId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Updated Category Name');
    expect(body.providerId).toBe(providerProviderId);

    const dbCat = await prisma.vehicleCategory.findUnique({ where: { id: categoryId } });
    expect(dbCat?.name).toBe('Updated Category Name');
  });

  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const req = new Request(`http://localhost/api/provider/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Noop' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: categoryId }) });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/provider/categories/[id]', () => {
  it('(a) cross-tenant DELETE returns 404 and does not delete the row', async () => {
    mockAuth(otherProviderToken);
    const req = new Request(`http://localhost/api/provider/categories/${categoryId}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: categoryId }) });
    expect(res.status).toBe(404);

    const dbCat = await prisma.vehicleCategory.findUnique({ where: { id: categoryId } });
    expect(dbCat).not.toBeNull();
  });

  it('(b) successful DELETE removes the row', async () => {
    mockAuth(providerToken);
    const req = new Request(`http://localhost/api/provider/categories/${categoryId}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: categoryId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);

    const dbCat = await prisma.vehicleCategory.findUnique({ where: { id: categoryId } });
    expect(dbCat).toBeNull();
    categoryId = '';
  });
});
