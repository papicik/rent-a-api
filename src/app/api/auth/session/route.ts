import { NextRequest, NextResponse } from 'next/server';
import { getSessionAddress } from '@/lib/siwe';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const address = await getSessionAddress(request);
  if (!address) {
    return NextResponse.json({ authenticated: false, address: null });
  }

  return NextResponse.json({ authenticated: true, address });
}
