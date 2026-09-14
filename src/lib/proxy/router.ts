export interface UpstreamRoutingConfig {
  targetUrl: string;
  headers: Record<string, string>;
  method: string;
}

/**
 * Resolves upstream URL and authentication headers based on slot's apiType or modelType.
 * Supports:
 * - CLAUDE_3_5_SONNET -> https://api.anthropic.com/v1/messages (inject 'x-api-key' & 'anthropic-version: 2023-06-01')
 * - GPT_4O -> https://api.openai.com/v1/chat/completions (inject 'Authorization: Bearer <decryptedKey>')
 * - DEEPSEEK_V3 -> https://api.deepseek.com/v1/chat/completions (inject 'Authorization: Bearer <decryptedKey>')
 * - GEMINI_1_5_PRO & GEMINI_FLASH_FREE -> https://generativelanguage.googleapis.com/v1beta/models/...:generateContent?key=<decryptedKey>
 */
export function resolveUpstreamRouting(
  apiTypeOrModel: string,
  decryptedKey: string
): UpstreamRoutingConfig {
  const normalized = (apiTypeOrModel || '').trim().toUpperCase().replace(/[-\s]/g, '_');

  // 1. Anthropic Claude
  if (normalized.includes('CLAUDE') || normalized.includes('ANTHROPIC')) {
    return {
      targetUrl: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': decryptedKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      method: 'POST',
    };
  }

  // 2. OpenAI GPT
  if (normalized.includes('GPT') || normalized.includes('OPENAI') || normalized.includes('O3')) {
    return {
      targetUrl: 'https://api.openai.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${decryptedKey}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    };
  }

  // 3. DeepSeek
  if (normalized.includes('DEEPSEEK')) {
    return {
      targetUrl: 'https://api.deepseek.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${decryptedKey}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    };
  }

  // 4. Google Gemini
  if (normalized.includes('GEMINI') || normalized.includes('GOOGLE')) {
    let geminiModel = 'gemini-1.5-pro';
    if (normalized.includes('FLASH')) {
      geminiModel = 'gemini-1.5-flash';
    } else if (normalized.includes('2_5')) {
      geminiModel = 'gemini-2.5-pro';
    }
    return {
      targetUrl: `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(decryptedKey)}`,
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    };
  }

  // Default fallback (OpenAI compatible chat completions)
  return {
    targetUrl: 'https://api.openai.com/v1/chat/completions',
    headers: {
      Authorization: `Bearer ${decryptedKey}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  };
}

/**
 * Strips sensitive upstream or internal headers before forwarding response to client.
 */
export function sanitizeResponseHeaders(
  sourceHeaders: Headers,
  additionalHeaders: Record<string, string> = {}
): Headers {
  const sanitized = new Headers();

  for (const [key, value] of sourceHeaders.entries()) {
    const lower = key.toLowerCase();
    // Strip upstream authentication, cloud internal, or provider identity headers
    if (
      lower === 'authorization' ||
      lower === 'x-api-key' ||
      lower.includes('key') ||
      lower.includes('secret') ||
      lower.includes('token') ||
      lower.includes('cookie') ||
      lower.startsWith('x-amz') ||
      lower.startsWith('x-goog-') ||
      lower.startsWith('cf-') ||
      lower === 'server' ||
      lower === 'x-powered-by'
    ) {
      continue;
    }
    sanitized.set(key, value);
  }

  for (const [k, v] of Object.entries(additionalHeaders)) {
    sanitized.set(k, v);
  }

  return sanitized;
}

// Memory fallback registry for tests/offline development
export const devTestRentals = new Map<
  string,
  {
    id: string;
    slotId?: string;
    status: string;
    expiresAtUtc: string;
    encryptedApiKey: string;
    iv: string;
    authTag: string;
    apiType: string;
    modelType: string;
  }
>();
