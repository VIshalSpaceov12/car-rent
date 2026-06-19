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
let branchId: string;

beforeAll(async () => {
  const providerUser = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!providerUser) throw new Error('provider@demo.test not found — run npm run db:seed');
  providerToken = signJwt(providerUser.id);
  providerProviderId = providerUser.providerId!;

  // Create a branch to operate on
  const br = await prisma.branch.create({
    data: {
      name: 'ID Route Test Branch',
      address: '1 Test Street',
      providerId: providerProviderId,
    },
  });
  branchId = br.id;

  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('Password123!', 10);
  const otherProvider = await prisma.provider.upsert({
    where: { slug: 'test-other-branch-id' },
    update: {},
    create: {
      name: 'Other Branch ID Provider',
      slug: 'test-other-branch-id',
      colors: { primary: 'black' },
    },
  });
  otherProviderProviderId = otherProvider.id;

  const otherUser = await prisma.user.upsert({
    where: { email: 'other-branch-id@test-isolation.test' },
    update: {},
    create: {
      email: 'other-branch-id@test-isolation.test',
      name: 'Other Branch ID User',
      role: 'PROVIDER',
      passwordHash: hash,
      providerId: otherProvider.id,
    },
  });
  otherProviderToken = signJwt(otherUser.id);
});

afterAll(async () => {
  await prisma.branch.deleteMany({ where: { id: branchId } }).catch(() => {});
  await prisma.branch.deleteMany({ where: { providerId: otherProviderProviderId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: 'other-branch-id@test-isolation.test' } }).catch(() => {});
  await prisma.provider.delete({ where: { slug: 'test-other-branch-id' } }).catch(() => {});
  await prisma.$disconnect();
});

import { PATCH, DELETE } from './route';

describe('PATCH /api/provider/branches/[id]', () => {
  it('(a) cross-tenant PATCH returns 404 and does not mutate the row', async () => {
    mockAuth(otherProviderToken);
    const req = new Request(`http://localhost/api/provider/branches/${branchId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Cross-Tenant Hack' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: branchId }) });
    expect(res.status).toBe(404);

    const dbBranch = await prisma.branch.findUnique({ where: { id: branchId } });
    expect(dbBranch?.name).toBe('ID Route Test Branch');
  });

  it('(c) successful PATCH updates only the session tenant\'s row', async () => {
    mockAuth(providerToken);
    const req = new Request(`http://localhost/api/provider/branches/${branchId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Branch Name' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: branchId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Updated Branch Name');
    expect(body.providerId).toBe(providerProviderId);

    const dbBranch = await prisma.branch.findUnique({ where: { id: branchId } });
    expect(dbBranch?.name).toBe('Updated Branch Name');
  });

  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const req = new Request(`http://localhost/api/provider/branches/${branchId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Noop' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: branchId }) });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/provider/branches/[id]', () => {
  it('(a) cross-tenant DELETE returns 404 and does not delete the row', async () => {
    mockAuth(otherProviderToken);
    const req = new Request(`http://localhost/api/provider/branches/${branchId}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: branchId }) });
    expect(res.status).toBe(404);

    const dbBranch = await prisma.branch.findUnique({ where: { id: branchId } });
    expect(dbBranch).not.toBeNull();
  });

  it('(b) successful DELETE removes the row', async () => {
    mockAuth(providerToken);
    const req = new Request(`http://localhost/api/provider/branches/${branchId}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: branchId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);

    const dbBranch = await prisma.branch.findUnique({ where: { id: branchId } });
    expect(dbBranch).toBeNull();
    branchId = '';
  });
});
