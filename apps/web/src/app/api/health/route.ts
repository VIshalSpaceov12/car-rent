import { NextResponse } from 'next/server';
import type { HealthResponse } from '@car-rental/types';

export async function GET() {
  return NextResponse.json<HealthResponse>({ status: 'ok', time: new Date().toISOString() });
}
