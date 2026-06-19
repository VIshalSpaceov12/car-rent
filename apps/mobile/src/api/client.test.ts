import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth/storage', () => ({ getToken: vi.fn().mockResolvedValue(null) }));
import { login, me } from './client';
import { getToken } from '@/auth/storage';

describe('mobile api client', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('POSTs credentials and returns null on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as never;
    expect(await login('x@y.z', 'bad')).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/login'), expect.objectContaining({ method: 'POST' }));
  });
});

describe('me()', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns the user and sends Authorization header on 200', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    const mockUser = { id: 'u1', role: 'customer', email: 'a@b.com', name: 'A', providerId: null, locale: 'en' };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockUser }) as never;
    const result = await me();
    expect(result).toEqual(mockUser);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer tok123' }),
      }),
    );
  });

  it('returns null on 401', async () => {
    vi.mocked(getToken).mockResolvedValueOnce('tok123');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }) as never;
    expect(await me()).toBeNull();
  });
});
