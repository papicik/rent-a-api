import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as proxyRoute } from '../app/api/v1/proxy/route';
import { devTestRentals } from '../lib/proxy/router';
import {
  extractTokenUsage,
  parseSseLineForTokens,
  recordTokenConsumption,
  createZeroLagTelemetryStream,
  devTestConsumption,
  incidentLog,
} from '../lib/proxy/telemetry';
import { encryptApiKey } from '../lib/crypto';

async function runStep4UpstreamUsageTests() {
  console.log('🧪 [STEP 4 TESTS START] Real Upstream Integration, Streaming Telemetry & Token Tracking...');

  // -------------------------------------------------------------
  // TEST 1: Token Usage Extraction Across Model Payloads
  // -------------------------------------------------------------
  console.log('1. Testing token usage parsing across standard AI model payloads...');
  {
    // A) OpenAI / DeepSeek format
    const openaiPayload = {
      id: 'chatcmpl-test-01',
      object: 'chat.completion',
      choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
      usage: {
        prompt_tokens: 18,
        completion_tokens: 42,
        total_tokens: 60,
      },
    };
    const openaiTokens = extractTokenUsage(openaiPayload, 'GPT_4O');
    assert.equal(openaiTokens, 60, 'OpenAI payload must parse total_tokens: 60');

    const deepseekPayload = {
      id: 'deepseek-test-01',
      choices: [{ message: { role: 'assistant', content: 'DeepSeek response' } }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 250,
        total_tokens: 350,
      },
    };
    const deepseekTokens = extractTokenUsage(deepseekPayload, 'DEEPSEEK_V3');
    assert.equal(deepseekTokens, 350, 'DeepSeek payload must parse total_tokens: 350');

    // B) Anthropic Claude format (input_tokens + output_tokens)
    const anthropicPayload = {
      id: 'msg_01XyZ',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Anthropic Claude reasoning.' }],
      usage: {
        input_tokens: 85,
        output_tokens: 115,
      },
    };
    const anthropicTokens = extractTokenUsage(anthropicPayload, 'CLAUDE_3_5_SONNET');
    assert.equal(anthropicTokens, 200, 'Anthropic payload must calculate input_tokens + output_tokens: 200');

    // C) Google Gemini format (usageMetadata)
    const geminiPayload = {
      candidates: [{ content: { parts: [{ text: 'Gemini multimodal response' }] } }],
      usageMetadata: {
        promptTokenCount: 120,
        candidatesTokenCount: 80,
        totalTokenCount: 200,
      },
    };
    const geminiTokens = extractTokenUsage(geminiPayload, 'GEMINI_1_5_PRO');
    assert.equal(geminiTokens, 200, 'Gemini payload must extract usageMetadata.totalTokenCount: 200');
  }

  // -------------------------------------------------------------
  // TEST 2: SSE Stream Telemetry Inspection & Zero-Lag Sequential Delivery
  // -------------------------------------------------------------
  console.log('2. Testing SSE streaming telemetry & sequential delivery without lag...');
  {
    const chunks = [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","usage":{"input_tokens":50}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Streaming "}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"chunk without lag"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":75}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Create upstream stream
    const upstreamStream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    let detectedStreamTokens = 0;
    const telemetryStream = createZeroLagTelemetryStream(
      upstreamStream,
      'CLAUDE_3_5_SONNET',
      (tokens) => {
        detectedStreamTokens = tokens;
      }
    );

    // Read downstream chunks sequentially
    const reader = telemetryStream.getReader();
    const receivedChunks: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedChunks.push(decoder.decode(value));
    }

    // Verify all chunks arrived in exact sequential order without truncation
    assert.equal(receivedChunks.length, chunks.length, 'Must deliver all chunks sequentially');
    for (let i = 0; i < chunks.length; i++) {
      assert.equal(receivedChunks[i], chunks[i], `Chunk ${i} must match upstream exactly`);
    }

    // Verify total token consumption was detected (input: 50 + output: 75 = 125)
    assert.equal(detectedStreamTokens, 125, 'SSE stream must detect 125 total tokens');
  }

  // -------------------------------------------------------------
  // TEST 3: DB/Slot Token Consumption & ApiSlot.usedPercentage Dynamic Recalculation
  // -------------------------------------------------------------
  console.log('3. Testing Slot consumption & ApiSlot.usedPercentage dynamic recalculation...');
  {
    const testSlotId = 'slot_test_telemetry_001';
    const testRentalId = 'rent_test_telemetry_001';

    // Seed mock slot with 5,000,000 daily quota
    devTestConsumption.set(testSlotId, {
      consumedTokens: 0,
      usedPercentage: 0,
      dailyQuota: 5_000_000,
    });

    // 1st consumption: 250,000 tokens (5% of 5M quota)
    const update1 = await recordTokenConsumption(testSlotId, testRentalId, 250_000);
    assert.equal(update1.consumedTokens, 250_000);
    assert.equal(update1.usedPercentage, 5.0, '250k / 5M must be 5.0% used');

    // 2nd consumption: 500,000 tokens (total 750k tokens = 15.0%)
    const update2 = await recordTokenConsumption(testSlotId, testRentalId, 500_000);
    assert.equal(update2.consumedTokens, 750_000);
    assert.equal(update2.usedPercentage, 15.0, '750k / 5M must be 15.0% used');
  }

  // -------------------------------------------------------------
  // TEST 4: End-to-End Proxy Route with Real SSE Streaming & Upstream Telemetry
  // -------------------------------------------------------------
  console.log('4. Testing end-to-end proxy route SSE streaming...');
  {
    const validProxyToken = 'rap_live_stream_telemetry_token_99';
    const activeKey = encryptApiKey('sk-ant-test-stream-key');

    devTestRentals.set(validProxyToken, {
      id: 'rent_sse_1',
      slotId: 'slot_sse_1',
      status: 'ACTIVE',
      expiresAtUtc: '2099-12-31T23:59:59.999Z',
      encryptedApiKey: activeKey.ciphertext,
      iv: activeKey.iv,
      authTag: activeKey.authTag,
      apiType: 'CLAUDE_3_5_SONNET',
      modelType: 'claude-sonnet-4',
    });

    devTestConsumption.set('slot_sse_1', {
      consumedTokens: 0,
      usedPercentage: 0,
      dailyQuota: 10_000_000,
    });

    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();

    globalThis.fetch = async (): Promise<Response> => {
      const sseBody = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"type":"message_start","message":{"usage":{"input_tokens":100}}}\n\n')
          );
          controller.enqueue(
            encoder.encode('data: {"type":"message_delta","usage":{"output_tokens":150}}\n\n')
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return new Response(sseBody, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        },
      });
    };

    try {
      const sseReq = new NextRequest('http://localhost:3000/api/v1/proxy', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${validProxyToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          stream: true,
          messages: [{ role: 'user', content: 'Stream test' }],
        }),
      });

      const sseRes = await proxyRoute(sseReq);
      assert.equal(sseRes.status, 200);
      assert.ok(sseRes.headers.get('content-type')?.includes('text/event-stream'));

      // Read response body to completion
      const reader = sseRes.body?.getReader();
      assert.ok(reader, 'Response body must be readable stream');
      const chunks: string[] = [];
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }

      assert.ok(chunks.length > 0, 'Stream must deliver chunks');

      // Check that consumption was recorded (100 in + 150 out = 250 tokens)
      const slotTelemetry = devTestConsumption.get('slot_sse_1');
      assert.ok(slotTelemetry);
      assert.equal(slotTelemetry.consumedTokens, 250, 'Slot must record 250 tokens from SSE stream');
      assert.equal(slotTelemetry.usedPercentage, 0.0, '250 / 10M is 0.0025% -> rounded 0.0%');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // -------------------------------------------------------------
  // TEST 5: Upstream Error Handling (401/403 Invalid Key & 429 Rate Limit)
  // -------------------------------------------------------------
  console.log('5. Testing upstream error handling (401 auth failure & 429 rate limit)...');
  {
    const originalFetch = globalThis.fetch;
    const testToken = 'rap_live_upstream_error_test_token';
    const encryptedKey = encryptApiKey('sk-revoked-key');

    devTestRentals.set(testToken, {
      id: 'rent_err_1',
      slotId: 'slot_err_1',
      status: 'ACTIVE',
      expiresAtUtc: '2099-12-31T23:59:59.999Z',
      encryptedApiKey: encryptedKey.ciphertext,
      iv: encryptedKey.iv,
      authTag: encryptedKey.authTag,
      apiType: 'GPT_4O',
      modelType: 'gpt-4o',
    });

    try {
      // A) Test 401 Upstream Auth Failure
      globalThis.fetch = async (): Promise<Response> => {
        return new Response(
          JSON.stringify({
            error: {
              message: 'Incorrect API key provided: sk-revoked-key...',
              type: 'invalid_request_error',
              code: 'invalid_api_key',
            },
          }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }
        );
      };

      const req401 = new NextRequest('http://localhost:3000/api/v1/proxy', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      const res401 = await proxyRoute(req401);
      assert.equal(res401.status, 502, 'Upstream 401 must return 502 Bad Gateway with clean message');
      const body401 = await res401.json();
      assert.equal(body401.error, 'Upstream Authentication Failed');
      // Verify raw upstream error details or keys are not leaked
      assert.ok(!JSON.stringify(body401).includes('sk-revoked-key'), 'Must not leak upstream raw key');

      // B) Test 429 Upstream Rate Limit Exceeded
      globalThis.fetch = async (): Promise<Response> => {
        return new Response(
          JSON.stringify({
            error: {
              message: 'Rate limit reached for organization org-123 on tokens per min.',
              type: 'tokens',
              code: 'rate_limit_exceeded',
            },
          }),
          {
            status: 429,
            headers: { 'content-type': 'application/json', 'retry-after': '20' },
          }
        );
      };

      const req429 = new NextRequest('http://localhost:3000/api/v1/proxy', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${testToken}`,
        },
      });

      const res429 = await proxyRoute(req429);
      assert.equal(res429.status, 503, 'Upstream 429 must return 503 Service Unavailable');
      const body429 = await res429.json();
      assert.equal(body429.error, 'Upstream Rate Limit Exceeded');
      assert.ok(res429.headers.get('retry-after'), 'Must include Retry-After header');

      // Verify incident log captured both events
      assert.ok(incidentLog.length >= 2, 'Incidents must be recorded in incident log');
      const lastIncident = incidentLog[incidentLog.length - 1];
      assert.equal(lastIncident.incidentType, 'RATE_LIMIT');
      assert.equal(lastIncident.slotId, 'slot_err_1');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  console.log('✅ [STEP 4 UPSTREAM & USAGE TESTS PASSED SUCCESSFULLY!]');
}

runStep4UpstreamUsageTests().catch((err) => {
  console.error('❌ Step 4 Tests failed:', err);
  process.exit(1);
});
