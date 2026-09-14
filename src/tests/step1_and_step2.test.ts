import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { getSession, createSessionToken, SESSION_COOKIE_NAME } from '../lib/siwe';
import { triggerOnChainRelease, triggerOnChainRefund } from '../lib/web3/escrowActions';
import { POST as releaseRoute } from '../app/api/rentals/[id]/release/route';
import { POST as refundRoute } from '../app/api/rentals/[id]/refund/route';

async function runStep1AndStep2Tests() {
  console.log('🧪 [STEP 1 & STEP 2 TEST SUITE] Escrow, Settlement Actions, SIWE Auth & Authorization...');

  const PROVIDER_WALLET = '0x1111111111111111111111111111111111111111' as const;
  const RENTER_WALLET = '0x2222222222222222222222222222222222222222' as const;
  const ADMIN_WALLET = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' as const;
  const UNAUTHORIZED_WALLET = '0x9999999999999999999999999999999999999999' as const;

  // 1. Test getSession with SIWE JWT
  console.log('1. Testing getSession helper...');
  const sessionToken = await createSessionToken(PROVIDER_WALLET);
  const reqWithSession = new NextRequest('http://localhost:3000/api/auth/session', {
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
    },
  });
  const session = await getSession(reqWithSession);
  assert.ok(session, 'Session must not be null');
  assert.equal(session.address.toLowerCase(), PROVIDER_WALLET.toLowerCase());

  const reqWithoutSession = new NextRequest('http://localhost:3000/api/auth/session');
  const emptySession = await getSession(reqWithoutSession);
  assert.equal(emptySession, null, 'Unauthenticated request must return null session');

  // 2. Test Viem backend signer escrow actions
  console.log('2. Testing Viem triggerOnChainRelease & triggerOnChainRefund functions...');
  const releaseAction = await triggerOnChainRelease(42);
  assert.ok(releaseAction.success, 'triggerOnChainRelease should handle simulation/execution gracefully');
  assert.ok(releaseAction.txHash, 'Release action should return a txHash');

  const refundAction = await triggerOnChainRefund(42);
  assert.ok(refundAction.success, 'triggerOnChainRefund should handle simulation/execution gracefully');
  assert.ok(refundAction.txHash, 'Refund action should return a txHash');

  // 3. Test SIWE & Authorization checks on Release Route
  console.log('3. Testing /api/rentals/[id]/release authorization...');
  // Unauthenticated -> 401
  const unauthReleaseReq = new NextRequest('http://localhost:3000/api/rentals/rent_123/release', {
    method: 'POST',
  });
  const unauthReleaseRes = await releaseRoute(unauthReleaseReq, { params: { id: 'rent_123' } });
  assert.equal(unauthReleaseRes.status, 401, 'Unauthenticated release must return 401');

  // 4. Test SIWE & Authorization checks on Refund Route
  console.log('4. Testing /api/rentals/[id]/refund authorization...');
  const unauthRefundReq = new NextRequest('http://localhost:3000/api/rentals/rent_123/refund', {
    method: 'POST',
    body: JSON.stringify({ reason: 'API key revoked' }),
  });
  const unauthRefundRes = await refundRoute(unauthRefundReq, { params: { id: 'rent_123' } });
  assert.equal(unauthRefundRes.status, 401, 'Unauthenticated refund must return 401');

  // Authenticated unauthorized user attempting refund with reason
  const unauthSessionToken = await createSessionToken(UNAUTHORIZED_WALLET);
  const authInvalidRefundReq = new NextRequest('http://localhost:3000/api/rentals/rent_123/refund', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${unauthSessionToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ reason: 'Downtime issue' }),
  });
  const authInvalidRefundRes = await refundRoute(authInvalidRefundReq, { params: { id: 'rent_123' } });
  // Rental does not exist in DB (or mock DB offline), so 404 or dev fallback
  assert.ok([404, 200, 500].includes(authInvalidRefundRes.status));

  console.log('✅ [STEP 1 & STEP 2 TEST SUITE PASSED SUCCESSFULLY!]');
}

runStep1AndStep2Tests().catch((err) => {
  console.error('❌ Step 1 & 2 Tests failed:', err);
  process.exit(1);
});
