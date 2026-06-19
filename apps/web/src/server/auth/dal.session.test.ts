import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must mock next/headers before importing dal
vi.mock('next/headers', () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    session: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { headers, cookies } from 'next/headers';
import { prisma } from '@/server/db';
import { verifySession } from './dal';
import { signJwt } from './jwt';

const mockUser = {
  id: 'u1', email: 'test@x.com', name: 'Test User',
  role: 'provider', providerId: 'prov1', locale: 'EN',
};

function makeHeaders(authValue: string | null) {
  return { get: vi.fn().mockReturnValue(authValue) };
}

function makeCookies(sessionId?: string) {
  return { get: vi.fn().mockReturnValue(sessionId ? { value: sessionId } : undefined) };
}

describe('verifySession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('(a) valid bearer JWT returns the mapped SessionUser', async () => {
    const token = signJwt('u1');
    vi.mocked(headers).mockResolvedValue(makeHeaders(`Bearer ${token}`) as never);
    vi.mocked(cookies).mockResolvedValue(makeCookies() as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const result = await verifySession();

    expect(result).toEqual({
      id: 'u1', email: 'test@x.com', name: 'Test User',
      role: 'provider', providerId: 'prov1', locale: 'en',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('(b) valid non-expired cookie session returns user', async () => {
    vi.mocked(headers).mockResolvedValue(makeHeaders(null) as never);
    vi.mocked(cookies).mockResolvedValue(makeCookies('sess-123') as never);
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: 'sess-123', userId: 'u1',
      expiresAt: new Date(Date.now() + 86400_000), // future
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const result = await verifySession();

    expect(result).not.toBeNull();
    expect(result?.id).toBe('u1');
  });

  it('(c) expired cookie session returns null', async () => {
    vi.mocked(headers).mockResolvedValue(makeHeaders(null) as never);
    vi.mocked(cookies).mockResolvedValue(makeCookies('sess-expired') as never);
    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: 'sess-expired', userId: 'u1',
      expiresAt: new Date(Date.now() - 86400_000), // past
    } as never);

    const result = await verifySession();

    expect(result).toBeNull();
  });

  it('(d) no auth at all returns null', async () => {
    vi.mocked(headers).mockResolvedValue(makeHeaders(null) as never);
    vi.mocked(cookies).mockResolvedValue(makeCookies() as never);

    const result = await verifySession();

    expect(result).toBeNull();
  });
});
