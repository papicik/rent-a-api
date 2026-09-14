import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { verifyMessage } from 'viem';
import crypto from 'crypto';

const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'rent-a-api-siwe-session-secret-key-32-chars-long!!'
);

export const NONCE_COOKIE_NAME = 'siwe_nonce';
export const SESSION_COOKIE_NAME = 'siwe_session';

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function createSiweMessage(address: string, nonce: string, chainId: number = 421614): string {
  return `rent-a-api wants you to sign in with your Ethereum account:
${address}

Sign in with Ethereum to authenticate with Rent-a-API.

URI: https://rent-a-api.xyz
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;
}

export async function createSessionToken(address: string): Promise<string> {
  return await new SignJWT({ address: address.toLowerCase() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<`0x${string}` | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload && typeof payload.address === 'string' && payload.address.startsWith('0x')) {
      return payload.address as `0x${string}`;
    }
    return null;
  } catch {
    return null;
  }
}

export async function verifySiweSignature({
  address,
  message,
  signature,
  storedNonce,
}: {
  address: `0x${string}`;
  message: string;
  signature: `0x${string}`;
  storedNonce: string;
}): Promise<boolean> {
  if (!storedNonce || !message.includes(storedNonce)) {
    return false;
  }

  try {
    return await verifyMessage({
      address,
      message,
      signature,
    });
  } catch {
    return false;
  }
}

export async function getSessionAddress(request: NextRequest): Promise<`0x${string}` | null> {
  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieToken) {
    const address = await verifySessionToken(cookieToken);
    if (address) return address;
  }

  // Also support Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const address = await verifySessionToken(token);
    if (address) return address;
  }

  return null;
}

export async function getSession(
  request: NextRequest
): Promise<{ address: `0x${string}` } | null> {
  const address = await getSessionAddress(request);
  if (!address) return null;
  return { address };
}

export async function requireAuth(
  request: NextRequest
): Promise<{ address: `0x${string}` } | { error: NextResponse }> {
  const session = await getSession(request);
  if (!session) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      ),
    };
  }
  return session;
}
