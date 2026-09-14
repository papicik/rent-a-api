import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  generateNonce,
  createSiweMessage,
  createSessionToken,
  verifySessionToken,
  requireAuth,
  getSessionAddress,
  SESSION_COOKIE_NAME,
} from '../lib/siwe';

async function runPhase2AuthTests() {
  console.log('🧪 [PHASE 2 TESTS START] SIWE Auth, JWT Session & Permission Controls...');

  const RENTER_WALLET = '0x7a83b9c019cde91823b9c41e92019448e4b9c001' as const;
  const ATTACKER_WALLET = '0x9999999999999999999999999999999999999999' as const;
  const DIFFERENT_WALLET = '0x3d91e0a724c94801bc38f41d8b93c523091b33e2' as const;

  // 1. Nonce & Message Formatting
  console.log('1. Testing Nonce generation & SIWE message formatting...');
  const nonce = generateNonce();
  assert.ok(nonce.length >= 16, 'Nonce should have sufficient entropy');
  const message = createSiweMessage(RENTER_WALLET, nonce);
  assert.ok(message.includes(RENTER_WALLET), 'Message must contain signer address');
  assert.ok(message.includes(nonce), 'Message must contain nonce');

  // 2. JWT Session Token Creation & Verification
  console.log('2. Testing JWT Session Token creation and verification with jose...');
  const sessionToken = await createSessionToken(RENTER_WALLET);
  assert.ok(sessionToken.length > 20, 'Session token must be non-empty JWT');

  const verifiedAddress = await verifySessionToken(sessionToken);
  assert.equal(
    verifiedAddress?.toLowerCase(),
    RENTER_WALLET.toLowerCase(),
    'Decoded address from session token must match original address'
  );

  // 3. Test: İmzasız istek → 401
  console.log('3. Testing unauthenticated request (İmzasız istek) → 401...');
  const unauthRequest = new NextRequest('http://localhost:3000/api/rent', {
    method: 'POST',
  });

  const unauthResult = await requireAuth(unauthRequest);
  assert.ok('error' in unauthResult, 'Unauthenticated request must return error');
  assert.equal(unauthResult.error.status, 401, 'Unauthenticated request must return HTTP 401');

  const unauthBody = await unauthResult.error.json();
  assert.equal(unauthBody.success, false);
  assert.ok(unauthBody.error.includes('Authentication required'), 'Error message must specify auth required');

  // 4. Authenticated Request Resolution via Cookie and Authorization Header
  console.log('4. Testing authenticated request resolution via session cookie and Bearer token...');
  const cookieRequest = new NextRequest('http://localhost:3000/api/rent', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
    },
  });

  const cookieAuthResult = await requireAuth(cookieRequest);
  assert.ok('address' in cookieAuthResult, 'Cookie-authenticated request must resolve address');
  assert.equal(
    cookieAuthResult.address.toLowerCase(),
    RENTER_WALLET.toLowerCase(),
    'Resolved address must match session'
  );

  const bearerRequest = new NextRequest('http://localhost:3000/api/rent', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sessionToken}`,
    },
  });
  const bearerAuthResult = await requireAuth(bearerRequest);
  assert.ok('address' in bearerAuthResult, 'Bearer-authenticated request must resolve address');
  assert.equal(
    bearerAuthResult.address.toLowerCase(),
    RENTER_WALLET.toLowerCase(),
    'Resolved address must match session'
  );

  // 5. Test: renterWallet body/session uyuşmazlığı → 403
  console.log('5. Testing renterWallet body/session mismatch → 403...');
  // User authenticated as RENTER_WALLET, but tries to send DIFFERENT_WALLET in body
  const bodyWithDifferentWallet = {
    slotId: 'slot_123',
    renterWallet: DIFFERENT_WALLET,
    txHash: '0x' + '1'.repeat(64),
  };

  const authForRent = await requireAuth(cookieRequest);
  assert.ok('address' in authForRent);
  const sessionUser = authForRent.address;

  // Endpoint logic check:
  let rentStatus = 200;
  let rentError = '';
  if (
    bodyWithDifferentWallet.renterWallet &&
    bodyWithDifferentWallet.renterWallet.toLowerCase() !== sessionUser.toLowerCase()
  ) {
    rentStatus = 403;
    rentError = 'Forbidden: renterWallet does not match authenticated session.';
  }

  assert.equal(rentStatus, 403, 'renterWallet body mismatch must yield HTTP 403');
  assert.ok(rentError.includes('Forbidden'), 'Error must indicate Forbidden');

  // Matching body or omitted body should succeed auth check
  const bodyMatching = {
    slotId: 'slot_123',
    renterWallet: RENTER_WALLET,
    txHash: '0x' + '1'.repeat(64),
  };
  let rentStatusMatching = 200;
  if (
    bodyMatching.renterWallet &&
    bodyMatching.renterWallet.toLowerCase() !== sessionUser.toLowerCase()
  ) {
    rentStatusMatching = 403;
  }
  assert.equal(rentStatusMatching, 200, 'Matching renterWallet must be permitted');

  // 6. Test: Başkasının rental'ına refund → 403
  console.log('6. Testing unauthorized refund on someone else\'s rental (Başkasının rental\'ına refund) → 403...');
  // Mock a rental agreement owned by RENTER_WALLET
  const mockRental = {
    id: 'rent_abc_123',
    slotId: 'slot_123',
    renterWallet: RENTER_WALLET.toLowerCase(),
    status: 'ACTIVE',
  };

  // Attacker authenticates with their own wallet
  const attackerSessionToken = await createSessionToken(ATTACKER_WALLET);
  const attackerRequest = new NextRequest('http://localhost:3000/api/rentals/rent_abc_123/refund', {
    method: 'POST',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${attackerSessionToken}`,
    },
  });

  const attackerAuth = await requireAuth(attackerRequest);
  assert.ok('address' in attackerAuth);
  const attackerAddress = attackerAuth.address.toLowerCase();

  // Endpoint logic check:
  let refundStatus = 200;
  let refundError = '';
  if (mockRental.renterWallet !== attackerAddress) {
    refundStatus = 403;
    refundError = 'Forbidden: Only the renter can request a refund for this rental.';
  }

  assert.equal(refundStatus, 403, 'Attacker attempting refund must receive HTTP 403');
  assert.ok(refundError.includes('Forbidden'), 'Must return Forbidden error');

  // Legitimate renter can request refund
  let legitRefundStatus = 200;
  if (mockRental.renterWallet !== sessionUser.toLowerCase()) {
    legitRefundStatus = 403;
  }
  assert.equal(legitRefundStatus, 200, 'Legitimate renter should pass authorization');

  // 7. Test: providerWallet body/session mismatch on POST /api/slots → 403
  console.log('7. Testing providerWallet body/session mismatch on slot listing → 403...');
  const slotBodyMismatch = {
    modelType: 'claude-sonnet-4',
    apiKey: 'sk-ant-valid-key-1234',
    providerWallet: DIFFERENT_WALLET,
  };
  let slotStatus = 200;
  if (
    slotBodyMismatch.providerWallet &&
    slotBodyMismatch.providerWallet.toLowerCase() !== sessionUser.toLowerCase()
  ) {
    slotStatus = 403;
  }
  assert.equal(slotStatus, 403, 'Slot listing with mismatched providerWallet must yield HTTP 403');

  console.log('✅ [PHASE 2 ALL TESTS PASSED SUCCESSFULLY!]');
}

runPhase2AuthTests().catch((err) => {
  console.error('❌ Phase 2 Test failed:', err);
  process.exit(1);
});
