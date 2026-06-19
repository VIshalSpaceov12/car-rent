import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ set: () => {} }) }));

import { POST } from './route';

const req = (body: unknown) =>
  new Request('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('POST /api/auth/login', () => {
  it('rejects bad credentials with 401', async () => {
    const res = await POST(req({ email: 'customer@demo.test', password: 'wrong' }));
    expect(res.status).toBe(401);
  });
  it('logs the seeded customer in', async () => {
    const res = await POST(req({ email: 'customer@demo.test', password: 'Password123!' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.role).toBe('customer');
  });
  it('returns 400 on an invalid body', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
