/**
 * Integration tests for /api/admin/providers (GET + POST)
 * and /api/admin/providers/[id] (PATCH).
 *
 * Uses the real seeded DB; mocks next/headers to inject auth tokens.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';
import { signJwt } from '@/server/auth/jwt';
import { authenticate } from '@/server/modules/auth/auth.service';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: async () => ({ get: () => undefined }),
}));

import { headers } from 'next/headers';
import { GET, POST } from './route';
import { PATCH } from './[id]/route';

function mockAuth(token: string) {
  vi.mocked(headers).mockResolvedValue({
    get: (name: string) => (name === 'authorization' ? `Bearer ${token}` : null),
  } as never);
}
function mockNoAuth() {
  vi.mocked(headers).mockResolvedValue({ get: () => null } as never);
}
function req(method: string, url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

let adminToken: string;
let providerToken: string;
let customerToken: string;
let createdProviderId: string;
const TEST_SLUG = `test-onboard-${Date.now()}`;
const TEST_EMAIL = `owner-${Date.now()}@test.test`;

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

  // Cleanup any leftover test data
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => {});
  await prisma.provider.deleteMany({ where: { slug: TEST_SLUG } }).catch(() => {});
});

afterAll(async () => {
  // Cleanup created test provider and owner
  if (createdProviderId) {
    await prisma.user.deleteMany({ where: { providerId: createdProviderId } }).catch(() => {});
    await prisma.businessSettings.deleteMany({ where: { providerId: createdProviderId } }).catch(() => {});
    await prisma.provider.delete({ where: { id: createdProviderId } }).catch(() => {});
  }
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => {});
  await prisma.provider.deleteMany({ where: { slug: TEST_SLUG } }).catch(() => {});
  await prisma.$disconnect();
});

// ─── Authorization: non-admin roles must be blocked ─────────────────────────

describe('Authorization — GET /api/admin/providers', () => {
  it('rejects unauthenticated (401)', async () => {
    mockNoAuth();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('rejects customer (403)', async () => {
    mockAuth(customerToken);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('rejects provider role (403)', async () => {
    mockAuth(providerToken);
    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe('Authorization — POST /api/admin/providers', () => {
  it('rejects unauthenticated (401)', async () => {
    mockNoAuth();
    const res = await POST(req('POST', 'http://localhost/api/admin/providers', {}));
    expect(res.status).toBe(401);
  });

  it('rejects customer (403)', async () => {
    mockAuth(customerToken);
    const res = await POST(req('POST', 'http://localhost/api/admin/providers', {}));
    expect(res.status).toBe(403);
  });

  it('rejects provider role (403)', async () => {
    mockAuth(providerToken);
    const res = await POST(req('POST', 'http://localhost/api/admin/providers', {}));
    expect(res.status).toBe(403);
  });
});

// ─── Admin happy-path ────────────────────────────────────────────────────────

describe('GET /api/admin/providers — admin sees all tenants', () => {
  it('returns list of all providers with counts', async () => {
    mockAuth(adminToken);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    const drivehub = body.find((p: { slug: string }) => p.slug === 'drivehub');
    expect(drivehub).toBeDefined();
    expect(drivehub.counts).toBeDefined();
    expect(typeof drivehub.counts.bookings).toBe('number');
    expect(typeof drivehub.counts.vehicles).toBe('number');
    expect(typeof drivehub.counts.users).toBe('number');
  });
});

describe('POST /api/admin/providers — onboard a new provider', () => {
  it('returns 400 on invalid body', async () => {
    mockAuth(adminToken);
    const res = await POST(req('POST', 'http://localhost/api/admin/providers', { name: 'Missing fields' }));
    expect(res.status).toBe(400);
  });

  it('onboards provider + creates BusinessSettings + owner user, returns 201', async () => {
    mockAuth(adminToken);
    const res = await POST(
      req('POST', 'http://localhost/api/admin/providers', {
        name: 'Test Provider',
        slug: TEST_SLUG,
        ownerName: 'Test Owner',
        ownerEmail: TEST_EMAIL,
        ownerPassword: 'Password123!',
        // Privilege escalation attempt — role must be ignored
        ownerRole: 'admin',
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    createdProviderId = body.id;

    expect(body.slug).toBe(TEST_SLUG);
    expect(body.status).toBe('active');

    // Verify DB: provider exists with BusinessSettings
    const prov = await prisma.provider.findUnique({ where: { id: createdProviderId } });
    expect(prov).toBeDefined();
    expect(prov!.status).toBe('active');

    const settings = await prisma.businessSettings.findUnique({ where: { providerId: createdProviderId } });
    expect(settings).toBeDefined();

    // Verify owner: role must be PROVIDER, not admin
    const owner = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(owner).toBeDefined();
    expect(owner!.role).toBe('PROVIDER'); // ownerRole: 'admin' was ignored
    expect(owner!.providerId).toBe(createdProviderId);
  });

  it('returns 409 on duplicate slug', async () => {
    mockAuth(adminToken);
    const res = await POST(
      req('POST', 'http://localhost/api/admin/providers', {
        name: 'Dupe Provider',
        slug: TEST_SLUG,
        ownerName: 'Another Owner',
        ownerEmail: `other-${Date.now()}@test.test`,
        ownerPassword: 'Password123!',
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('slug_taken');
  });

  it('newly created owner can authenticate and is scoped only to their tenant', async () => {
    const result = await authenticate(TEST_EMAIL, 'Password123!');
    expect(result).not.toBeNull();
    expect(result!.user.role).toBe('provider');
    expect(result!.user.providerId).toBe(createdProviderId);
  });
});

// ─── PATCH /api/admin/providers/[id] ─────────────────────────────────────────

describe('PATCH /api/admin/providers/[id]', () => {
  it('rejects unauthenticated (401)', async () => {
    mockNoAuth();
    const providerRow = await prisma.provider.findUnique({ where: { slug: 'drivehub' } });
    const res = await PATCH(
      req('PATCH', `http://localhost/api/admin/providers/${providerRow!.id}`, { status: 'suspended' }),
      { params: Promise.resolve({ id: providerRow!.id }) },
    );
    expect(res.status).toBe(401);
  });

  it('rejects customer (403)', async () => {
    mockAuth(customerToken);
    const providerRow = await prisma.provider.findUnique({ where: { slug: 'drivehub' } });
    const res = await PATCH(
      req('PATCH', `http://localhost/api/admin/providers/${providerRow!.id}`, { status: 'suspended' }),
      { params: Promise.resolve({ id: providerRow!.id }) },
    );
    expect(res.status).toBe(403);
  });

  it('rejects non-admin (403)', async () => {
    mockAuth(providerToken);
    const providerRow = await prisma.provider.findUnique({ where: { slug: 'drivehub' } });
    const res = await PATCH(
      req('PATCH', `http://localhost/api/admin/providers/${providerRow!.id}`, { status: 'suspended' }),
      { params: Promise.resolve({ id: providerRow!.id }) },
    );
    expect(res.status).toBe(403);
  });

  it('admin approves a pending provider', async () => {
    // sunset-rentals is seeded as 'pending'
    mockAuth(adminToken);
    const pendingProvider = await prisma.provider.findUnique({ where: { slug: 'sunset-rentals' } });
    if (!pendingProvider) return; // skip if not seeded

    const res = await PATCH(
      req('PATCH', `http://localhost/api/admin/providers/${pendingProvider.id}`, { status: 'active' }),
      { params: Promise.resolve({ id: pendingProvider.id }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('active');

    // Restore to pending for idempotency
    await prisma.provider.update({ where: { id: pendingProvider.id }, data: { status: 'pending' } });
  });

  it('admin suspends a provider; their user is then blocked (suspended enforcement)', async () => {
    if (!createdProviderId) return; // depends on onboard test

    mockAuth(adminToken);
    const res = await PATCH(
      req('PATCH', `http://localhost/api/admin/providers/${createdProviderId}`, { status: 'suspended' }),
      { params: Promise.resolve({ id: createdProviderId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('suspended');

    // Now the owner's JWT should be blocked by verifySession (suspended enforcement in DAL)
    const owner = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (!owner) return;
    const ownerToken = signJwt(owner.id);
    mockAuth(ownerToken);

    // Calling any provider route should return null from verifySession → 401
    // We use GET /api/admin/providers (which requires admin) as a quick sentinel
    // Instead verify using the DAL directly:
    const { verifySession } = await import('@/server/auth/dal');
    const session = await verifySession();
    expect(session).toBeNull(); // suspended user blocked
  });

  it('admin user is not blocked after suspending a provider', async () => {
    mockAuth(adminToken);
    const res = await GET();
    expect(res.status).toBe(200); // admin still works
  });

  it('returns 404 for unknown provider id', async () => {
    mockAuth(adminToken);
    const res = await PATCH(
      req('PATCH', 'http://localhost/api/admin/providers/nonexistent-id', { status: 'active' }),
      { params: Promise.resolve({ id: 'nonexistent-id' }) },
    );
    expect(res.status).toBe(404);
  });
});
