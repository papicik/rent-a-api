import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/crypto';
import { proxyRateLimiter } from '@/lib/rateLimit';
import {
  extractTokenUsage,
  createZeroLagTelemetryStream,
  recordTokenConsumption,
  recordUpstreamIncident,
} from '@/lib/proxy/telemetry';
import {
  resolveUpstreamRouting,
  sanitizeResponseHeaders,
  devTestRentals,
} from '@/lib/proxy/router';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Extract Bearer token from 'Authorization' header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Missing or invalid Bearer token. Please provide Authorization: Bearer <proxyToken>',
        },
        { status: 401 }
      );
    }

    const proxyToken = authHeader.substring(7).trim();
    if (!proxyToken) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Empty Bearer proxy token provided.',
        },
        { status: 401 }
      );
    }

    // 2. Query Rental and Slot from DB (with dev/test fallback if DB offline)
    let rentalRecord: {
      id: string;
      status: string;
      rentalDate: string;
      slot: {
        id: string;
        encryptedApiKey: string;
        iv: string;
        authTag: string;
        apiType: string | null;
        modelType: string;
      };
    } | null = null;

    try {
      const dbRental = await prisma.rental.findUnique({
        where: { proxyToken },
        include: { slot: true },
      });
      if (dbRental) {
        rentalRecord = {
          id: dbRental.id,
          status: dbRental.status,
          rentalDate: dbRental.rentalDate,
          slot: {
            id: dbRental.slot.id,
            encryptedApiKey: dbRental.slot.encryptedApiKey,
            iv: dbRental.slot.iv,
            authTag: dbRental.slot.authTag,
            apiType: dbRental.slot.apiType,
            modelType: dbRental.slot.modelType,
          },
        };
      }
    } catch (dbErr: unknown) {
      if (
        process.env.NODE_ENV !== 'production' &&
        dbErr instanceof Error &&
        dbErr.message.includes("Can't reach database server")
      ) {
        const testRental = devTestRentals.get(proxyToken);
        if (testRental) {
          rentalRecord = {
            id: testRental.id,
            status: testRental.status,
            rentalDate: testRental.expiresAtUtc.split('T')[0],
            slot: {
              id: testRental.slotId || 'slot_dev_test',
              encryptedApiKey: testRental.encryptedApiKey,
              iv: testRental.iv,
              authTag: testRental.authTag,
              apiType: testRental.apiType,
              modelType: testRental.modelType,
            },
          };
        }
      } else {
        throw dbErr;
      }
    }

    // 3. Confirm rental exists
    if (!rentalRecord) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Invalid or non-existent proxy token.',
        },
        { status: 403 }
      );
    }

    // 4. Confirm lease status is strictly 'ACTIVE'
    if (rentalRecord.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: `Rental lease is not active. Current status: ${rentalRecord.status}`,
        },
        { status: 403 }
      );
    }

    // 5. Confirm current time is within 'expiresAt' (23:59:59.999 UTC)
    const expiresAt = new Date(`${rentalRecord.rentalDate}T23:59:59.999Z`);
    if (Date.now() > expiresAt.getTime()) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: `Rental lease has expired on ${expiresAt.toISOString()}.`,
        },
        { status: 403 }
      );
    }

    // 6. Sliding window rate limit check (prevents rapid key exhaustion)
    const rateLimit = proxyRateLimiter.check(proxyToken);
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetTime - Date.now()) / 1000));
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded for this rental proxy token. Please slow down requests.',
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.resetTime),
          },
        }
      );
    }

    // 7. Decrypt the provider's original API key using decryptApiKey
    let decryptedKey: string;
    try {
      decryptedKey = decryptApiKey({
        ciphertext: rentalRecord.slot.encryptedApiKey,
        iv: rentalRecord.slot.iv,
        authTag: rentalRecord.slot.authTag,
      });
    } catch (decryptErr) {
      console.error('[Proxy Engine] Key decryption failed:', decryptErr);
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: 'Failed to decrypt provider API key for proxying.',
        },
        { status: 500 }
      );
    }

    // 8. Resolve Upstream Routing
    const effectiveApiType = rentalRecord.slot.apiType || rentalRecord.slot.modelType;
    const upstream = resolveUpstreamRouting(effectiveApiType, decryptedKey);

    // 9. Read incoming body
    const bodyText = await request.text();

    // 10. Forward to upstream provider
    const upstreamResponse = await fetch(upstream.targetUrl, {
      method: upstream.method,
      headers: upstream.headers,
      body: bodyText || undefined,
    });

    // 11. Error Handling & Upstream Fallback (401 / 403 / 429)
    if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
      recordUpstreamIncident(rentalRecord.slot.id, rentalRecord.id, upstreamResponse.status);
      return NextResponse.json(
        {
          error: 'Upstream Authentication Failed',
          message:
            'The upstream model provider rejected the provider credentials. The key may be revoked or inactive. You are eligible for an immediate refund.',
          upstreamStatus: upstreamResponse.status,
          slotId: rentalRecord.slot.id,
        },
        { status: 502 }
      );
    }

    if (upstreamResponse.status === 429) {
      recordUpstreamIncident(rentalRecord.slot.id, rentalRecord.id, 429);
      return NextResponse.json(
        {
          error: 'Upstream Rate Limit Exceeded',
          message:
            'The provider upstream account has exceeded its rate limit or token quota. Please wait a moment or request a refund.',
          upstreamStatus: 429,
          slotId: rentalRecord.slot.id,
        },
        {
          status: 503,
          headers: {
            'Retry-After': '10',
          },
        }
      );
    }

    // 12. Response Headers Sanitization (masking provider/upstream internals)
    const responseHeaders = sanitizeResponseHeaders(upstreamResponse.headers, {
      'x-rent-proxy-status': 'ACTIVE',
      'x-rent-rate-limit-remaining': String(rateLimit.remaining),
      'x-rent-rate-limit-limit': String(rateLimit.limit),
    });

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const isStream =
      contentType.includes('text/event-stream') ||
      upstreamResponse.headers.get('transfer-encoding') === 'chunked';

    // 13. Zero-Lag Streaming Telemetry & Token Tracking for SSE
    if (isStream && upstreamResponse.body) {
      const telemetryStream = createZeroLagTelemetryStream(
        upstreamResponse.body,
        effectiveApiType,
        async (detectedTokens) => {
          if (rentalRecord) {
            await recordTokenConsumption(
              rentalRecord.slot.id,
              rentalRecord.id,
              detectedTokens,
              request.headers.get('x-forwarded-for') || undefined
            );
          }
        }
      );

      return new NextResponse(telemetryStream, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    // 14. Non-streaming response: parse usage metrics and update DB consumption
    const responseText = await upstreamResponse.text();
    try {
      const parsedJson = JSON.parse(responseText);
      const detectedTokens = extractTokenUsage(parsedJson, effectiveApiType);
      if (detectedTokens > 0) {
        await recordTokenConsumption(
          rentalRecord.slot.id,
          rentalRecord.id,
          detectedTokens,
          request.headers.get('x-forwarded-for') || undefined
        );
      }
    } catch {
      // Non-JSON response, ignore parse error
    }

    return new NextResponse(responseText, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    console.error('[Proxy Engine Error]:', error);
    const message = error instanceof Error ? error.message : 'Internal Proxy Error';
    return NextResponse.json(
      {
        error: 'Proxy Forwarding Error',
        message,
      },
      { status: 500 }
    );
  }
}
