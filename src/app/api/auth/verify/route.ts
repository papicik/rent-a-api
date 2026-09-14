import { NextRequest, NextResponse } from 'next/server';
import {
  verifySiweSignature,
  createSessionToken,
  NONCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '@/lib/siwe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, message, signature } = body;

    if (!address || !message || !signature) {
      return NextResponse.json(
        { success: false, error: 'address, message, and signature are required.' },
        { status: 400 }
      );
    }

    const storedNonce = request.cookies.get(NONCE_COOKIE_NAME)?.value;
    if (!storedNonce) {
      return NextResponse.json(
        { success: false, error: 'Authentication nonce expired or not found. Please request a new nonce.' },
        { status: 400 }
      );
    }

    const isValid = await verifySiweSignature({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
      storedNonce,
    });

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Signature verification failed. Invalid message or signature.' },
        { status: 400 }
      );
    }

    // Generate JWT session token
    const token = await createSessionToken(address);

    const response = NextResponse.json({
      success: true,
      address: address.toLowerCase(),
      token,
      message: 'Successfully authenticated via SIWE.',
    });

    // Write session cookie
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Clear nonce cookie
    response.cookies.set(NONCE_COOKIE_NAME, '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Authentication failed.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
