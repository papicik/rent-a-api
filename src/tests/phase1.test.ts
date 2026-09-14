import assert from 'node:assert/strict';
import {
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
  maskWallet,
  generateProxyToken,
} from '../lib/crypto';
import { calculateIdleKeyPrice, getRentTwapRateUsd } from '../lib/pricing';
import { createSlotSchema } from '../lib/validations/slot';
import { rentSlotSchema } from '../lib/validations/rental';

async function runPhase1Tests() {
  console.log('🧪 [PHASE 1 TESTS START] Idle Credit Model, Crypto, TWAP & Validations...');

  // 1. AES-256-GCM Round-Trip Test
  console.log('1. Testing AES-256-GCM Encryption & Decryption (96-bit IV, 128-bit Auth Tag)...');
  const testKey = 'sk-ant-api03-sample-production-key-99182374619a';
  const encrypted = encryptApiKey(testKey);

  assert.ok(encrypted.ciphertext.length > 0, 'Ciphertext must not be empty');
  assert.equal(encrypted.iv.length, 24, 'IV must be 12 bytes (24 hex characters)');
  assert.equal(encrypted.authTag.length, 32, 'Auth tag must be 16 bytes (32 hex characters)');

  const decrypted = decryptApiKey(encrypted);
  assert.equal(decrypted, testKey, 'Decrypted key must match original');

  // 2. Tampering & Integrity Test
  console.log('2. Testing GCM Authentication Tag Tamper Rejection...');
  const tamperedCiphertext = encrypted.ciphertext.slice(0, -2) + 'ff';
  assert.throws(
    () => decryptApiKey({ ...encrypted, ciphertext: tamperedCiphertext }),
    /Unsupported state or unable to authenticate data/,
    'Tampered ciphertext must fail GCM auth tag check'
  );

  // 3. Masking Functions Test
  console.log('3. Testing Key & Wallet Masking...');
  const maskedKey = maskApiKey(testKey);
  assert.equal(maskedKey, 'sk-ant...619a', 'API key must be masked safely');
  assert.ok(!maskedKey.includes('sample-production'), 'Raw key must never be visible');

  const testWallet = '0x7a83b9c019cde91823b9c41e92019448e4b9c001';
  const maskedWalletAddress = maskWallet(testWallet);
  assert.equal(maskedWalletAddress, '0x7a83...c001', 'Wallet address must be masked properly');

  // 4. Proxy Token Generation
  console.log('4. Testing Proxy Token Generation & rap_live_ Prefix...');
  const token = generateProxyToken();
  assert.ok(token.startsWith('rap_live_'), 'Proxy token must start with rap_live_');
  assert.ok(token.length >= 50, 'Proxy token must have high entropy');

  // 5. Idle Credit Pricing Formula & 65% Discount Test
  console.log('5. Testing Idle Key Pricing Model (35% suggested / 65% cheaper)...');
  // Claude Sonnet 4: $6.00 / 1M. Quota: 5M tokens.
  // dailyQuotaValueUsd = (5M / 1M) * $6.00 = $30.00
  // When remainingCredit (25M) >= dailyQuota (5M):
  // suggestedDailyPriceUsd = 30.00 * 0.35 = $10.50 (65% cheaper)
  // Hard cap = 30.00 * 0.60 = $18.00
  // TWAP @ 0.05 USD / RENT => 10.50 / 0.05 = 210 RENT
  const standardPricing = calculateIdleKeyPrice('claude-sonnet-4', 5_000_000, 25_000_000);
  assert.equal(standardPricing.dailyQuotaValueUsd, 30.00, 'Official daily quota value must be $30.00');
  assert.equal(standardPricing.suggestedDailyPriceUsd, 10.50, 'Suggested daily rent must be $10.50 (35% of official)');
  assert.equal(standardPricing.hardCapUsd, 18.00, 'Hard cap must be $18.00 (60% of official)');
  assert.equal(standardPricing.discountPercentage, 65, 'Must be 65% cheaper');
  assert.equal(standardPricing.isLowCredit, false, 'Should not be marked low credit');
  assert.equal(standardPricing.suggestedDailyPriceRent, 210, 'TWAP must equal 210 RENT');

  // 6. Low Credit Automatic Discount Test
  console.log('6. Testing Low Credit Automatic Discount (< dailyQuota)...');
  // o3: $20.00 / 1M. Quota: 2M ($40 value).
  // Remaining credit: 1.2M (< 2M).
  // remainingCreditValueUsd = 1.2M * $20 = $24.00
  // suggestedDailyPriceUsd = 24.00 * 0.35 = $8.40!
  const lowCreditPricing = calculateIdleKeyPrice('o3', 2_000_000, 1_200_000);
  assert.equal(lowCreditPricing.isLowCredit, true, 'Must trigger isLowCredit flag');
  assert.equal(lowCreditPricing.suggestedDailyPriceUsd, 8.40, 'Must discount based on remaining credit');
  assert.ok(lowCreditPricing.discountPercentage > 65, 'Discount percentage must be higher than 65%');

  // 7. Hard Cap Enforcement Test
  console.log('7. Testing 60% Hard Cap Enforcement in Pricing & Zod...');
  // Attempt to set custom price $25.00 on Claude Sonnet 4 (5M quota = $30 official, cap = $18)
  const cappedPricing = calculateIdleKeyPrice('claude-sonnet-4', 5_000_000, 25_000_000, 25.00);
  assert.ok(cappedPricing.suggestedDailyPriceUsd <= cappedPricing.hardCapUsd, 'Price must never exceed hard cap ($18)');

  // Zod rejection for price exceeding 60% cap
  const invalidCapResult = createSlotSchema.safeParse({
    modelType: 'claude-sonnet-4',
    apiKey: 'sk-ant-api03-valid-secret-key-1234',
    dailyQuota: 5_000_000,
    remainingCredit: 25_000_000,
    customPriceUsd: 22.00, // Exceeds $18.00 cap!
    providerWallet: '0x7a83b9c019cde91823b9c41e92019448e4b9c001',
  });
  assert.equal(invalidCapResult.success, false, 'Custom price exceeding 60% hard cap must be rejected by Zod');

  // Valid slot creation
  const validSlotResult = createSlotSchema.safeParse({
    modelType: 'gpt-4o',
    apiKey: 'sk-proj-gpt4o-enterprise-valid-key-1234',
    dailyQuota: 4_000_000,
    remainingCredit: 12_000_000,
    customPriceUsd: 8.00, // Within cap ($20 * 0.60 = $12)
    providerWallet: '0x3d91e0a724c94801bc38f41d8b93c523091b33e2',
  });
  assert.equal(validSlotResult.success, true, 'Valid slot within hard cap must be accepted');

  // 8. Rental Schema Validation Test
  console.log('8. Testing Rental Validation Schema with Auto UTC Day...');
  const validRental = rentSlotSchema.safeParse({
    slotId: 'slot_123',
    renterWallet: '0x7a83b9c019cde91823b9c41e92019448e4b9c001',
    txHash: '0x391823a9b91823901bca98102391029381029381029381029381029381029381',
  });
  assert.equal(validRental.success, true, 'Rental schema must succeed with auto UTC date and mandatory txHash');
  if (validRental.success) {
    assert.ok(validRental.data.rentalDate, 'rentalDate must be automatically populated');
  }

  console.log('✅ [PHASE 1 ALL TESTS PASSED SUCCESSFULLY!]');
}

runPhase1Tests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
