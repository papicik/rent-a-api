import { NextResponse } from 'next/server';
import { generateNonce, NONCE_COOKIE_NAME } from '@/lib/siwe';

export const dynamic = 'force-dynamic';

export async function GET() {
  const nonce = generateNonce();

  const response = NextResponse.json({
    success: true,
    nonce,
  });

  response.cookies.set(NONCE_COOKIE_NAME, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300, // 5 minutes
  });

  return response;
}
