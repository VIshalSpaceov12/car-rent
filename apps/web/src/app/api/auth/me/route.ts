import { NextResponse } from 'next/server';
import { verifySession } from '@/server/auth/dal';

export async function GET() {
  const user = await verifySession();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(user);
}
