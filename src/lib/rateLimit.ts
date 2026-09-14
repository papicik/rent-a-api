/**
 * Sliding Window Rate Limiter for Reverse Proxy
 * Provides in-memory sliding window tracking with Redis-ready interface.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

export class SlidingWindowRateLimiter {
  private windows: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly defaultLimit: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(windowMs: number = 60_000, defaultLimit: number = 60) {
    this.windowMs = windowMs;
    this.defaultLimit = defaultLimit;

    // Periodic sweep of idle keys every 2 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 120_000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Checks if the request for the given key is allowed under the sliding window.
   */
  public check(key: string, limit: number = this.defaultLimit): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Keep only timestamps within the active sliding window
    timestamps = timestamps.filter((ts) => ts > windowStart);
    this.windows.set(key, timestamps);

    if (timestamps.length >= limit) {
      const oldestInWindow = timestamps[0] || now;
      const resetTime = oldestInWindow + this.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        limit,
      };
    }

    // Record this request
    timestamps.push(now);

    return {
      allowed: true,
      remaining: Math.max(0, limit - timestamps.length),
      resetTime: now + this.windowMs,
      limit,
    };
  }

  /**
   * Cleans up expired windows to prevent memory leaks.
   */
  public cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.windows.entries()) {
      const active = timestamps.filter((ts) => ts > windowStart);
      if (active.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, active);
      }
    }
  }

  /**
   * Resets rate limit for a specific key or all keys (useful for testing).
   */
  public reset(key?: string): void {
    if (key) {
      this.windows.delete(key);
    } else {
      this.windows.clear();
    }
  }
}

// Global shared instance for the proxy engine (60 requests per minute by default)
export const proxyRateLimiter = new SlidingWindowRateLimiter(60_000, 60);
