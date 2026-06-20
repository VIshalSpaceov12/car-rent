import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/server/db';

afterAll(async () => {
  await prisma.$disconnect();
});

import { GET } from './route';

describe('GET /api/branding', () => {
  it('returns 200 with brand colors', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string; primary: string; primaryDark: string; logoUrl: string | null };
    expect(typeof body.name).toBe('string');
    expect(body.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(body.primaryDark).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect('logoUrl' in body).toBe(true);
  });

  it('returns the drivehub provider brand when seeded', async () => {
    const res = await GET();
    const body = await res.json() as { name: string; primary: string };
    // drivehub is seeded with primary #F97316
    expect(body.primary).toBe('#F97316');
    expect(body.name).toBe('DriveHub');
  });
});
