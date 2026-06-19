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
function req(method: string, url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

let providerToken: string;
let customerToken: string;
let providerId: string;
let createdStaffId: string;

beforeAll(async () => {
  const provider = await prisma.user.findUnique({ where: { email: 'provider@demo.test' } });
  if (!provider) throw new Error('provider@demo.test not seeded');
  providerToken = signJwt(provider.id);
  providerId = provider.providerId!;

  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.test' } });
  if (!customer) throw new Error('customer@demo.test not seeded');
  customerToken = signJwt(customer.id);

  // Clean up any leftover test staff
  await prisma.user.deleteMany({ where: { email: 'staff-test@test.test' } });
});

afterAll(async () => {
  if (createdStaffId) {
    await prisma.user.delete({ where: { id: createdStaffId } }).catch(() => {});
  }
  await prisma.user.deleteMany({ where: { email: 'staff-test@test.test' } }).catch(() => {});
  await prisma.$disconnect();
});

import { GET, POST } from './route';

describe('GET /api/provider/staff', () => {
  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 for customers', async () => {
    mockAuth(customerToken);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns staff list for provider', async () => {
    mockAuth(providerToken);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const s of body) {
      expect(s.role).toBe('staff');
      expect(s.providerId).toBe(providerId);
    }
  });
});

describe('POST /api/provider/staff', () => {
  it('returns 401 when unauthenticated', async () => {
    mockNoAuth();
    const res = await POST(req('POST', 'http://localhost/api/provider/staff', {
      name: 'Test Staff', email: 'staff-test@test.test', password: 'Password123!',
    }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for customers', async () => {
    mockAuth(customerToken);
    const res = await POST(req('POST', 'http://localhost/api/provider/staff', {
      name: 'Test Staff', email: 'staff-test@test.test', password: 'Password123!',
    }));
    expect(res.status).toBe(403);
  });

  it('creates a STAFF user with providerId from session (ignores client-sent role/providerId)', async () => {
    mockAuth(providerToken);
    const res = await POST(req('POST', 'http://localhost/api/provider/staff', {
      name: 'Test Staff',
      email: 'staff-test@test.test',
      password: 'Password123!',
      // Privilege escalation attempts — must be ignored
      role: 'admin',
      providerId: 'fake-provider-id',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    createdStaffId = body.id;

    expect(body.role).toBe('staff'); // Not admin
    expect(body.providerId).toBe(providerId); // From session, not client body
    expect(body.email).toBe('staff-test@test.test');

    // Verify in DB
    const db = await prisma.user.findUnique({ where: { id: body.id } });
    expect(db!.role).toBe('STAFF');
    expect(db!.providerId).toBe(providerId);
  });

  it('returns 409 for duplicate email', async () => {
    mockAuth(providerToken);
    const res = await POST(req('POST', 'http://localhost/api/provider/staff', {
      name: 'Duplicate Staff', email: 'staff-test@test.test', password: 'Password123!',
    }));
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid body', async () => {
    mockAuth(providerToken);
    const res = await POST(req('POST', 'http://localhost/api/provider/staff', { name: 'No email' }));
    expect(res.status).toBe(400);
  });
});
