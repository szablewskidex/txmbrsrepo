/**
 * Simple in-memory rate limiter for client-side protection
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now >= entry.resetTime) {
      // New window
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetIn: this.config.windowMs,
      };
    }

    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: entry.resetTime - now,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetIn: entry.resetTime - now,
    };
  }

  reset(key: string): void {
    this.limits.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

// Global rate limiters
export const melodyGenerationLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 requests per minute
});

export const chordSuggestionLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000, // 20 requests per minute
});

// Cleanup old entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    melodyGenerationLimiter.cleanup();
    chordSuggestionLimiter.cleanup();
  }, 5 * 60 * 1000);
}
