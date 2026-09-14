import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export interface TokenMetrics {
  totalTokens: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ConsumptionUpdateResult {
  consumedTokens: number;
  usedPercentage: number;
  dailyQuota: number;
}

// In-memory telemetry fallback for testing & offline development
export const devTestConsumption = new Map<
  string,
  { consumedTokens: number; usedPercentage: number; dailyQuota: number }
>();

// In-memory incident record storage
export interface UpstreamIncident {
  slotId: string;
  rentalId: string;
  statusCode: number;
  incidentType: 'AUTH_FAILURE' | 'RATE_LIMIT' | 'UPSTREAM_ERROR';
  timestamp: string;
  message: string;
}
export const incidentLog: UpstreamIncident[] = [];

/**
 * Parses token usage metrics from standard AI provider response payloads.
 * Supports:
 * - OpenAI / DeepSeek: usage.total_tokens (or prompt_tokens + completion_tokens)
 * - Anthropic: usage.input_tokens + usage.output_tokens (or message.usage)
 * - Google Gemini: usageMetadata.totalTokenCount
 */
export function extractTokenUsage(payload: unknown, apiTypeOrModel?: string): number {
  if (!payload || typeof payload !== 'object') {
    return 0;
  }

  const p = payload as Record<string, any>;
  const normalized = (apiTypeOrModel || '').toUpperCase().replace(/[-\s]/g, '_');

  // 1. Google Gemini (usageMetadata)
  if (p.usageMetadata) {
    if (typeof p.usageMetadata.totalTokenCount === 'number') {
      return p.usageMetadata.totalTokenCount;
    }
    const prompt = p.usageMetadata.promptTokenCount || 0;
    const candidates = p.usageMetadata.candidatesTokenCount || 0;
    if (prompt + candidates > 0) {
      return prompt + candidates;
    }
  }

  // 2. Anthropic Claude (message.usage or top-level usage)
  const anthropicUsage = p.usage || (p.message && p.message.usage);
  if (anthropicUsage) {
    const input = anthropicUsage.input_tokens || 0;
    const output = anthropicUsage.output_tokens || 0;
    if (input + output > 0) {
      return input + output;
    }
  }

  // 3. OpenAI / DeepSeek (usage.total_tokens)
  if (p.usage) {
    if (typeof p.usage.total_tokens === 'number') {
      return p.usage.total_tokens;
    }
    const prompt = p.usage.prompt_tokens || 0;
    const completion = p.usage.completion_tokens || 0;
    if (prompt + completion > 0) {
      return prompt + completion;
    }
  }

  // 4. Anthropic delta events in SSE
  if (p.type === 'message_delta' && p.usage && typeof p.usage.output_tokens === 'number') {
    return p.usage.output_tokens;
  }

  return 0;
}

/**
 * Parses an individual SSE line or buffer snippet to detect token usage metrics.
 */
export function parseSseLineForTokens(
  line: string,
  apiTypeOrModel?: string,
  anthropicAcc?: { inputTokens: number; outputTokens: number }
): number {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) {
    return 0;
  }

  const rawJson = trimmed.slice(5).trim();
  if (rawJson === '[DONE]') {
    return 0;
  }

  try {
    const parsed = JSON.parse(rawJson);

    // Anthropic streaming uses message_start (input) and message_delta (output)
    if (parsed.type === 'message_start' && parsed.message?.usage?.input_tokens) {
      if (anthropicAcc) {
        anthropicAcc.inputTokens = parsed.message.usage.input_tokens;
      }
      return parsed.message.usage.input_tokens;
    }

    if (parsed.type === 'message_delta' && parsed.usage?.output_tokens) {
      if (anthropicAcc) {
        anthropicAcc.outputTokens = (anthropicAcc.outputTokens || 0) + parsed.usage.output_tokens;
      }
      return parsed.usage.output_tokens;
    }

    // OpenAI, DeepSeek, Gemini in SSE data line
    return extractTokenUsage(parsed, apiTypeOrModel);
  } catch {
    return 0;
  }
}

/**
 * Updates daily token consumption on Slot & Rental, and recalculates ApiSlot.usedPercentage.
 */
export async function recordTokenConsumption(
  slotId: string,
  rentalId: string,
  tokensConsumed: number,
  ip?: string
): Promise<ConsumptionUpdateResult> {
  const actualTokens = Math.max(1, tokensConsumed);

  try {
    const [updatedRental, currentSlot] = await prisma.$transaction([
      prisma.rental.update({
        where: { id: rentalId },
        data: {
          usedQuota: { increment: actualTokens },
        },
      }),
      prisma.slot.findUnique({
        where: { id: slotId },
      }),
    ]);

    if (!currentSlot) {
      throw new Error(`Slot with id ${slotId} not found.`);
    }

    const newConsumed = (currentSlot.consumedTokens || 0) + actualTokens;
    const totalDailyQuota = currentSlot.dailyQuota || 1;
    const usedPercentage = Math.round((newConsumed / totalDailyQuota) * 10000) / 100;

    await prisma.$transaction([
      prisma.slot.update({
        where: { id: slotId },
        data: {
          consumedTokens: newConsumed,
          usedPercentage,
        },
      }),
      prisma.usageLog.create({
        data: {
          rentalId,
          requestCount: 1,
          tokenCount: actualTokens,
          ipHash: ip
            ? crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16)
            : null,
        },
      }),
    ]);

    return {
      consumedTokens: newConsumed,
      usedPercentage,
      dailyQuota: totalDailyQuota,
    };
  } catch (error: unknown) {
    // Non-production fallback when PostgreSQL is offline
    if (
      process.env.NODE_ENV !== 'production' &&
      error instanceof Error &&
      error.message.includes("Can't reach database server")
    ) {
      const existing = devTestConsumption.get(slotId) || {
        consumedTokens: 0,
        usedPercentage: 0,
        dailyQuota: 5_000_000,
      };

      const newConsumed = existing.consumedTokens + actualTokens;
      const usedPercentage = Math.round((newConsumed / existing.dailyQuota) * 10000) / 100;
      const updated = {
        consumedTokens: newConsumed,
        usedPercentage,
        dailyQuota: existing.dailyQuota,
      };
      devTestConsumption.set(slotId, updated);
      return updated;
    }
    throw error;
  }
}

/**
 * Creates a zero-buffering TransformStream that delivers SSE chunks sequentially
 * to the client without buffering lag, while inspecting the stream for token metrics.
 */
export function createZeroLagTelemetryStream(
  upstreamStream: ReadableStream<Uint8Array>,
  apiTypeOrModel: string,
  onStreamComplete: (tokensDetected: number) => Promise<void> | void
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = '';
  let detectedTokens = 0;
  const anthropicAcc = { inputTokens: 0, outputTokens: 0 };

  const transformStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      // 1. Instantly forward chunk to client with ZERO buffering lag
      controller.enqueue(chunk);

      // 2. Telemetry inspection in stream pass-through
      try {
        const text = decoder.decode(chunk, { stream: true });
        buffer += text;

        const lines = buffer.split('\n');
        // Keep incomplete trailing line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const tokens = parseSseLineForTokens(line, apiTypeOrModel, anthropicAcc);
          if (tokens > 0) {
            detectedTokens = Math.max(detectedTokens, tokens);
          }
        }
      } catch (err) {
        console.error('[Telemetry Stream Inspection Error]:', err);
      }
    },
    async flush() {
      // Process any remaining bytes
      if (buffer.trim()) {
        const tokens = parseSseLineForTokens(buffer, apiTypeOrModel, anthropicAcc);
        if (tokens > 0) {
          detectedTokens = Math.max(detectedTokens, tokens);
        }
      }

      // Anthropic total = inputTokens + outputTokens
      if (anthropicAcc.inputTokens + anthropicAcc.outputTokens > 0) {
        detectedTokens = anthropicAcc.inputTokens + anthropicAcc.outputTokens;
      }

      // Fallback estimate if upstream didn't send usage metadata in stream chunks
      if (detectedTokens === 0) {
        detectedTokens = 150; // Conservative baseline estimate for active SSE requests
      }

      try {
        await onStreamComplete(detectedTokens);
      } catch (e) {
        console.error('[Telemetry Stream Completion Error]:', e);
      }
    },
  });

  return upstreamStream.pipeThrough(transformStream);
}

/**
 * Records an upstream incident (401 invalid key, 429 rate limit exceeded) to prevent
 * cascading retries and track provider SLAs.
 */
export function recordUpstreamIncident(
  slotId: string,
  rentalId: string,
  statusCode: number,
  upstreamErrorMessage?: string
): UpstreamIncident {
  const incidentType: UpstreamIncident['incidentType'] =
    statusCode === 401 || statusCode === 403
      ? 'AUTH_FAILURE'
      : statusCode === 429
      ? 'RATE_LIMIT'
      : 'UPSTREAM_ERROR';

  const incident: UpstreamIncident = {
    slotId,
    rentalId,
    statusCode,
    incidentType,
    timestamp: new Date().toISOString(),
    message:
      statusCode === 401 || statusCode === 403
        ? 'Provider upstream API key authentication failed.'
        : statusCode === 429
        ? 'Provider upstream rate limit or account quota exceeded.'
        : `Upstream error status: ${statusCode}`,
  };

  incidentLog.push(incident);
  console.warn(
    `[Upstream Incident] Slot: ${slotId}, Rental: ${rentalId}, Type: ${incidentType}, Status: ${statusCode}`
  );

  return incident;
}
