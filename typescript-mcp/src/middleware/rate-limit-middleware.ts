/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { Response, NextFunction } from 'express';
import { type ExtendedRequest, type RateLimitConfig, HTTP_STATUS, RateLimitError } from './types.js';

// Rule 15: Global declarations for Node.js environment
declare const console: Console;
declare const setInterval: () => void;
declare const clearInterval: () => void;
// NodeJS type declarations removed to prevent unused variable warnings

// In-memory store for rate limiting (in production, use Redis)
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
    firstRequest: number;
  } | undefined;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req: ExtendedRequest) => req.clientIp ?? req.ip ?? 'unknown',
};

export class RateLimitMiddleware {
  private config: RateLimitConfig;
  private store: RateLimitStore = {};
  private cleanupInterval: unknown;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Main rate limiting middleware
   */
  limit = async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = this.config.keyGenerator ? this.config.keyGenerator(req) : this.getDefaultKey(req);
      const now = Date.now();

      // Get or create rate limit entry
      let entry = this.store[key];
      if (entry === undefined || entry.resetTime <= now) {
        entry = {
          count: 0,
          resetTime: now + this.config.windowMs,
          firstRequest: now,
        };
        this.store[key] = entry;
      }

      // Check if request should be counted
      const shouldCount = this.shouldCountRequest(req, res);

      if (shouldCount) {
        entry.count++;
      }

      // Set rate limit headers
      const remaining = Math.max(0, this.config.maxRequests - entry.count);
      const resetTime = new Date(entry.resetTime);

      res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime.toISOString());
      res.setHeader('X-RateLimit-Window', this.config.windowMs);

      // Add rate limit info to request
      req.rateLimit = {
        limit: this.config.maxRequests,
        remaining,
        resetTime,
      };

      // Check if limit exceeded
      if (entry.count > this.config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfter);

        if (this.config.onLimitReached) {
          this.config.onLimitReached(req, res);
        }

        throw new RateLimitError(this.config.message, retryAfter);
      }

      next();
    } catch (error) {
      this.handleRateLimitError(error, res);
    }
  };

  /**
   * Create rate limiter with custom config
   */
  static create(config: Partial<RateLimitConfig>): RateLimitMiddleware {
    return new RateLimitMiddleware(config);
  }

  /**
   * Strict rate limiter for sensitive endpoints
   */
  static strict(maxRequests = 10, windowMs = 15 * 60 * 1000): RateLimitMiddleware {
    return new RateLimitMiddleware({
      maxRequests,
      windowMs,
      message: 'Rate limit exceeded for sensitive operation',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    });
  }

  /**
   * Lenient rate limiter for public endpoints
   */
  static lenient(maxRequests = 1000, windowMs = 15 * 60 * 1000): RateLimitMiddleware {
    return new RateLimitMiddleware({
      maxRequests,
      windowMs,
      message: 'Rate limit exceeded',
      skipSuccessfulRequests: true,
      skipFailedRequests: false,
    });
  }

  /**
   * Per-user rate limiter
   */
  static perUser(maxRequests = 200, windowMs = 15 * 60 * 1000): RateLimitMiddleware {
    return new RateLimitMiddleware({
      maxRequests,
      windowMs,
      keyGenerator: (req: ExtendedRequest) => {
        if (req.user?.id) {
          return `user:${req.user.id}`;
        }
        return req.clientIp ?? req.ip ?? 'anonymous';
      },
    });
  }

  /**
   * Per-API-key rate limiter
   */
  static perApiKey(maxRequests = 500, windowMs = 15 * 60 * 1000): RateLimitMiddleware {
    return new RateLimitMiddleware({
      maxRequests,
      windowMs,
      keyGenerator: (req: ExtendedRequest) => {
        const apiKey = req.headers['x-api-key'] as string;
        if (apiKey) {
          return `apikey:${apiKey}`;
        }
        return req.clientIp ?? req.ip ?? 'no-api-key';
      },
    });
  }

  /**
   * Sliding window rate limiter
   */
  static slidingWindow(maxRequests = 100, windowMs = 15 * 60 * 1000): RateLimitMiddleware {
    const requests: { [key: string]: number[] | undefined } = {};

    return new RateLimitMiddleware({
      maxRequests,
      windowMs,
      keyGenerator: (req: ExtendedRequest) => {
        const key = req.clientIp ?? req.ip ?? 'unknown';
        const now = Date.now();

        // Initialize or clean old requests
        if (requests[key] === undefined) {
          requests[key] = [];
        }

        // Remove requests outside the window
        requests[key] = requests[key].filter(timestamp => now - timestamp < windowMs);

        // Add current request
        requests[key].push(now);

        // Check if limit exceeded
        if (requests[key].length > maxRequests) {
          throw new RateLimitError('Sliding window rate limit exceeded');
        }

        return key;
      },
    });
  }

  /**
   * Burst rate limiter - allows short bursts but limits sustained usage
   */
  static burst(
    burstLimit = 20,
    sustainedLimit = 100,
    burstWindowMs = 60 * 1000,
    sustainedWindowMs = 15 * 60 * 1000,
  ): RateLimitMiddleware {
    const burstLimiter = new RateLimitMiddleware({
      maxRequests: burstLimit,
      windowMs: burstWindowMs,
      message: 'Burst rate limit exceeded',
    });

    const sustainedLimiter = new RateLimitMiddleware({
      maxRequests: sustainedLimit,
      windowMs: sustainedWindowMs,
      message: 'Sustained rate limit exceeded',
    });

    return {
      limit: async (req: ExtendedRequest, res: Response, next: NextFunction) => {
        // Check burst limit first
        await new Promise<void>((resolve, reject) => {
          burstLimiter.limit(req, res, error => {
            if (error) {reject(error);} else {resolve();}
          });
        });

        // Then check sustained limit
        await sustainedLimiter.limit(req, res, next);
      },
    } as RateLimitMiddleware;
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    delete this.store[key];
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.store = {};
  }

  /**
   * Get current rate limit status for a key
   */
  getStatus(key: string): {
    count: number;
    remaining: number;
    resetTime: Date;
    isLimited: boolean;
  } | null {
    const entry = this.store[key];
    if (entry === undefined) {
      return null;
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.count);

    return {
      count: entry.count,
      remaining,
      resetTime: new Date(entry.resetTime),
      isLimited: entry.count >= this.config.maxRequests,
    };
  }

  /**
   * Get all current rate limit statuses
   */
  getAllStatuses(): { [key: string]: ReturnType<typeof this.getStatus> } {
    const statuses: { [key: string]: ReturnType<typeof this.getStatus> } = {};

    for (const key in this.store) {
      statuses[key] = this.getStatus(key);
    }

    return statuses;
  }

  /**
   * Get default key for rate limiting
   */
  private getDefaultKey(req: ExtendedRequest): string {
    return req.clientIp ?? 'unknown';
  }

  /**
   * Check if request should be counted towards rate limit
   */
  private shouldCountRequest(req: ExtendedRequest, res: Response): boolean {
    // Skip successful requests if configured
    if (this.config.skipSuccessfulRequests && res.statusCode < 400) {
      return false;
    }

    // Skip failed requests if configured
    if (this.config.skipFailedRequests && res.statusCode >= 400) {
      return false;
    }

    return true;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    for (const key in this.store) {
      if (this.store[key].resetTime <= now) {
        delete this.store[key];
      }
    }
  }

  /**
   * Handle rate limit errors
   */
  private handleRateLimitError(error: Error | RateLimitError, res: Response): void {
    if (error instanceof RateLimitError) {
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: 'Rate limit exceeded',
        message: error.message,
        retryAfter: error.retryAfter,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error('Rate limit middleware error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while processing rate limit',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalKeys: number;
    activeKeys: number;
    totalRequests: number;
    limitedKeys: number;
  } {
    const now = Date.now();
    let totalRequests = 0;
    let activeKeys = 0;
    let limitedKeys = 0;

    for (const key in this.store) {
      const entry = this.store[key];
      if (entry.resetTime > now) {
        activeKeys++;
        totalRequests += entry.count;
        if (entry.count >= this.config.maxRequests) {
          limitedKeys++;
        }
      }
    }

    return {
      totalKeys: Object.keys(this.store).length,
      activeKeys,
      totalRequests,
      limitedKeys,
    };
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store = {};
  }
}

// Create default instance
const rateLimitMiddleware = new RateLimitMiddleware();

// Export convenience functions
export const rateLimit = rateLimitMiddleware.limit;
export const strictRateLimit = RateLimitMiddleware.strict;
export const lenientRateLimit = RateLimitMiddleware.lenient;
export const perUserRateLimit = RateLimitMiddleware.perUser;
export const perApiKeyRateLimit = RateLimitMiddleware.perApiKey;
export const slidingWindowRateLimit = RateLimitMiddleware.slidingWindow;
export const burstRateLimit = RateLimitMiddleware.burst;

// Export default instance
export default rateLimitMiddleware;
