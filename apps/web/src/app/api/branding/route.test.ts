import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';

let seedPrimary: string;

beforeAll(async () => {
  // Read the current drivehub colors from DB so assertions are delta-based,
  // not hardcoded — avoids races with the PATCH branding test file.
  const drivehub = await prisma.provider.findUnique({
    where: { slug: 'drivehub' },
    select: { colors: true },
  });
  seedPrimary = (drivehub?.colors as { primary?: string } | null)?.primary ?? '#F97316';
});

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
    // Assert against the live DB value (delta-based) rather than a hardcoded hex
    // to avoid races with the PATCH branding test file that temporarily mutates drivehub.
    expect(body.primary).toBe(seedPrimary);
    expect(body.name).toBe('DriveHub');
  });
});
