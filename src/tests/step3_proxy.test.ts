import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as proxyRoute } from '../app/api/v1/proxy/route';
import {
  resolveUpstreamRouting,
  sanitizeResponseHeaders,
  devTestRentals,
} from '../lib/proxy/router';
import { encryptApiKey } from '../lib/crypto';
import { SlidingWindowRateLimiter, proxyRateLimiter } from '../lib/rateLimit';

async function runStep3ProxyTests() {
  console.log('🧪 [STEP 3 TESTS START] Reverse Proxy Engine, Upstream Routing & Rate Limiting...');

  const RAW_ANTHROPIC_KEY = 'sk-ant-api03-live-test-key-anthropic-12345';
  const RAW_OPENAI_KEY = 'sk-proj-live-test-key-openai-67890';
  const RAW_DEEPSEEK_KEY = 'sk-deepseek-live-test-key-998877';
  const RAW_GEMINI_KEY = 'AIzaSyLiveTestKeyGoogleGemini112233';

  // -------------------------------------------------------------
  // TEST 1: Unauthorized requests without Bearer token return 401
  // -------------------------------------------------------------
  console.log('1. Testing unauthorized requests without Bearer token -> 401...');
  {
    // A) No Authorization header
    const reqNoAuth = new NextRequest('http://localhost:3000/api/v1/proxy', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    });
    const resNoAuth = await proxyRoute(reqNoAuth);
    assert.equal(resNoAuth.status, 401, 'Missing Authorization header must return 401');
    const bodyNoAuth = await resNoAuth.json();
    assert.equal(bodyNoAuth.error, 'Unauthorized');

    // B) Invalid scheme (e.g. Basic auth)
    const reqBasicAuth = new NextRequest('http://localhost:3000/api/v1/proxy', {
      method: 'POST',
      headers: {
        authorization: 'Basic dXNlcjpwYXNz',
      },
    });
    const resBasicAuth = await proxyRoute(reqBasicAuth);
    assert.equal(resBasicAuth.status, 401, 'Non-Bearer Authorization must return 401');

    // C) Empty Bearer token
    const reqEmptyBearer = new NextRequest('http://localhost:3000/api/v1/proxy', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ',
      },
    });
    const resEmptyBearer = await proxyRoute(reqEmptyBearer);
    assert.equal(resEmptyBearer.status, 401, 'Empty Bearer token must return 401');
  }

  // -------------------------------------------------------------
  // TEST 2: Expired or non-existent proxy tokens return 403
  // -------------------------------------------------------------
  console.log('2. Testing non-existent, inactive, or expired proxy tokens -> 403...');
  {
    // A) Non-existent proxy token
    const reqNonExistent = new NextRequest('http://localhost:3000/api/v1/proxy', {
      method: 'POST',
      headers: {
        authorization: 'Bearer rap_live_non_existent_token_12345',
      },
    });
    const resNonExistent = await proxyRoute(reqNonExistent);
    assert.equal(resNonExistent.status, 403, 'Non-existent proxy token must return 403');
    const bodyNonExistent = await resNonExistent.json();
    assert.equal(bodyNonExistent.error, 'Forbidden');

    // B) Inactive lease status (e.g. REFUNDED or COMPLETED)
    const inactiveToken = 'rap_live_inactive_lease_token_test';
    const encryptedKey = encryptApiKey(RAW_OPENAI_KEY);
    devTestRentals.set(inactiveToken, {
      id: 'rent_inactive_1',
      status: 'REFUNDED',
      expiresAtUtc: '2099-12-31T23:59:59.999Z',
      encryptedApiKey: encryptedKey.ciphertext,
      iv: encryptedKey.iv,
      authTag: encryptedKey.authTag,
      apiType: 'GPT_4O',
      modelType: 'gpt-4o',
    });

    const reqInactive = new NextRequest('http://localhost:3000/api/v1/proxy', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${inactiveToken}`,
      },
    });
    const resInactive = await proxyRoute(reqInactive);
    assert.equal(resInactive.status, 403, 'Inactive lease status must return 403');
    const bodyInactive = await resInactive.json();
    assert.equal(bodyInactive.error, 'Forbidden');
    assert.ok(bodyInactive.message.includes('not active'));

    // C) Expired lease date (past UTC day)
    const expiredToken = 'rap_live_expired_lease_token_test';
    devTestRentals.set(expiredToken, {
      id: 'rent_expired_1',
      status: 'ACTIVE',
      expiresAtUtc: '2021-01-01T23:59:59.999Z',
      encryptedApiKey: encryptedKey.ciphertext,
      iv: encryptedKey.iv,
      authTag: encryptedKey.authTag,
      apiType: 'GPT_4O',
      modelType: 'gpt-4o',
    });

    const reqExpired = new NextRequest('http://localhost:3000/api/v1/proxy', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    });
    const resExpired = await proxyRoute(reqExpired);
    assert.equal(resExpired.status, 403, 'Expired lease must return 403');
    const bodyExpired = await resExpired.json();
    assert.equal(bodyExpired.error, 'Forbidden');
    assert.ok(bodyExpired.message.includes('expired'));
  }

  // -------------------------------------------------------------
  // TEST 3: Upstream Routing Resolution & Header Unmasking
  // -------------------------------------------------------------
  console.log('3. Testing upstream routing resolution & header unmasking...');
  {
    // A) CLAUDE_3_5_SONNET
    const claudeRouting = resolveUpstreamRouting('CLAUDE_3_5_SONNET', RAW_ANTHROPIC_KEY);
    assert.equal(
      claudeRouting.targetUrl,
      'https://api.anthropic.com/v1/messages',
      'Claude must route to https://api.anthropic.com/v1/messages'
    );
    assert.equal(
      claudeRouting.headers['x-api-key'],
      RAW_ANTHROPIC_KEY,
      'Claude must inject decrypted x-api-key'
    );
    assert.equal(
      claudeRouting.headers['anthropic-version'],
      '2023-06-01',
      'Claude must inject anthropic-version: 2023-06-01'
    );

    // B) GPT_4O
    const gptRouting = resolveUpstreamRouting('GPT_4O', RAW_OPENAI_KEY);
    assert.equal(
      gptRouting.targetUrl,
      'https://api.openai.com/v1/chat/completions',
      'GPT-4o must route to https://api.openai.com/v1/chat/completions'
    );
    assert.equal(
      gptRouting.headers['Authorization'],
      `Bearer ${RAW_OPENAI_KEY}`,
      'GPT-4o must inject Authorization: Bearer <decryptedKey>'
    );

    // C) DEEPSEEK_V3
    const deepseekRouting = resolveUpstreamRouting('DEEPSEEK_V3', RAW_DEEPSEEK_KEY);
    assert.equal(
      deepseekRouting.targetUrl,
      'https://api.deepseek.com/v1/chat/completions',
      'DeepSeek must route to https://api.deepseek.com/v1/chat/completions'
    );
    assert.equal(
      deepseekRouting.headers['Authorization'],
      `Bearer ${RAW_DEEPSEEK_KEY}`,
      'DeepSeek must inject Authorization: Bearer <decryptedKey>'
    );

    // D) GEMINI_1_5_PRO
    const geminiProRouting = resolveUpstreamRouting('GEMINI_1_5_PRO', RAW_GEMINI_KEY);
    assert.ok(
      geminiProRouting.targetUrl.includes('gemini-1.5-pro:generateContent'),
      'Gemini 1.5 Pro must route to models/gemini-1.5-pro:generateContent'
    );
    assert.ok(
      geminiProRouting.targetUrl.includes(`key=${RAW_GEMINI_KEY}`),
      'Gemini URL must contain unmasked key'
    );

    // E) GEMINI_FLASH_FREE
    const geminiFlashRouting = resolveUpstreamRouting('GEMINI_FLASH_FREE', RAW_GEMINI_KEY);
    assert.ok(
      geminiFlashRouting.targetUrl.includes('gemini-1.5-flash:generateContent'),
      'Gemini Flash must route to models/gemini-1.5-flash:generateContent'
    );
    assert.ok(
      geminiFlashRouting.targetUrl.includes(`key=${RAW_GEMINI_KEY}`),
      'Gemini Flash URL must contain unmasked key'
    );
  }

  // -------------------------------------------------------------
  // TEST 4: Valid Request Execution, Upstream Dispatch & Header Sanitization
  // -------------------------------------------------------------
  console.log('4. Testing valid request execution, proxying & response sanitization...');
  {
    const validProxyToken = 'rap_live_valid_active_token_test_abc123';
    const activeEncrypted = encryptApiKey(RAW_ANTHROPIC_KEY);

    devTestRentals.set(validProxyToken, {
      id: 'rent_valid_active_1',
      status: 'ACTIVE',
      expiresAtUtc: '2099-12-31T23:59:59.999Z',
      encryptedApiKey: activeEncrypted.ciphertext,
      iv: activeEncrypted.iv,
      authTag: activeEncrypted.authTag,
      apiType: 'CLAUDE_3_5_SONNET',
      modelType: 'claude-sonnet-4',
    });

    // Mock global fetch to capture forwarded headers and return stream response
    const originalFetch = globalThis.fetch;
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = '';

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capturedUrl = input.toString();
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = init?.body ? String(init.body) : '';

      return new Response(
        JSON.stringify({
          id: 'msg_01abc',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello from proxied upstream' }],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-api-key': 'SHOULD_BE_STRIPPED_BY_PROXY',
            'authorization': 'SHOULD_BE_STRIPPED_BY_PROXY',
            'server': 'cloudflare',
          },
        }
      );
    };

    try {
      const validReq = new NextRequest('http://localhost:3000/api/v1/proxy', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${validProxyToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet',
          messages: [{ role: 'user', content: 'Say hello' }],
        }),
      });

      const proxyRes = await proxyRoute(validReq);
      assert.equal(proxyRes.status, 200, 'Valid request must successfully return upstream status 200');

      // Verify upstream received the decrypted provider key in x-api-key
      assert.equal(capturedUrl, 'https://api.anthropic.com/v1/messages');
      assert.equal(capturedHeaders['x-api-key'], RAW_ANTHROPIC_KEY);
      assert.equal(capturedHeaders['anthropic-version'], '2023-06-01');
      assert.ok(capturedBody.includes('Say hello'));

      // Verify response headers: sensitive upstream headers are stripped
      assert.equal(proxyRes.headers.get('x-api-key'), null, 'x-api-key header must be stripped from response');
      assert.equal(proxyRes.headers.get('authorization'), null, 'authorization header must be stripped from response');
      assert.equal(proxyRes.headers.get('server'), null, 'server header must be stripped from response');
      assert.equal(proxyRes.headers.get('x-rent-proxy-status'), 'ACTIVE');

      const resJson = await proxyRes.json();
      assert.equal(resJson.id, 'msg_01abc');
      assert.equal(resJson.content[0].text, 'Hello from proxied upstream');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // -------------------------------------------------------------
  // TEST 5: Rate Limiting & Sliding Window Enforcement
  // -------------------------------------------------------------
  console.log('5. Testing sliding window rate limiting...');
  {
    const limiter = new SlidingWindowRateLimiter(60_000, 3); // 3 req / min limit for test
    const testKey = 'test_rate_limited_key';

    const r1 = limiter.check(testKey, 3);
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 2);

    const r2 = limiter.check(testKey, 3);
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 1);

    const r3 = limiter.check(testKey, 3);
    assert.equal(r3.allowed, true);
    assert.equal(r3.remaining, 0);

    // 4th request must be rejected
    const r4 = limiter.check(testKey, 3);
    assert.equal(r4.allowed, false, '4th request must exceed limit of 3');
    assert.equal(r4.remaining, 0);
    assert.ok(r4.resetTime > Date.now());

    // Reset limiter
    limiter.reset(testKey);
    const rAfterReset = limiter.check(testKey, 3);
    assert.equal(rAfterReset.allowed, true, 'Rate limit should be restored after reset');
  }

  // -------------------------------------------------------------
  // TEST 6: Response Header Sanitizer
  // -------------------------------------------------------------
  console.log('6. Testing sanitizeResponseHeaders security filter...');
  {
    const rawHeaders = new Headers({
      'content-type': 'application/json',
      'authorization': 'Bearer secret-token-leak',
      'x-api-key': 'secret-anthropic-key',
      'x-amz-cf-id': 'aws-internal-id',
      'x-goog-request-id': 'google-internal-id',
      'set-cookie': 'session=abc',
      'cache-control': 'no-cache',
    });

    const sanitized = sanitizeResponseHeaders(rawHeaders, { 'x-safe-header': 'ok' });
    assert.equal(sanitized.get('content-type'), 'application/json');
    assert.equal(sanitized.get('cache-control'), 'no-cache');
    assert.equal(sanitized.get('x-safe-header'), 'ok');
    assert.equal(sanitized.get('authorization'), null);
    assert.equal(sanitized.get('x-api-key'), null);
    assert.equal(sanitized.get('x-amz-cf-id'), null);
    assert.equal(sanitized.get('x-goog-request-id'), null);
    assert.equal(sanitized.get('set-cookie'), null);
  }

  console.log('✅ [STEP 3 PROXY TESTS PASSED SUCCESSFULLY!]');
}

runStep3ProxyTests().catch((err) => {
  console.error('❌ Step 3 Proxy Tests failed:', err);
  process.exit(1);
});
