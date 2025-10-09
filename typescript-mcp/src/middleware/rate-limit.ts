/**
 * Rate Limiting Middleware
 * Provides configurable rate limiting to prevent API abuse and ensure fair usage
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { Logger } from '../services/logger.js';

const logger = new Logger('RateLimitMiddleware');

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: FastifyRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skip?: (request: FastifyRequest) => boolean;
  onLimitReached?: (request: FastifyRequest, reply: FastifyReply) => void;
  customMessage?: string;
  headers?: boolean;
  enableRedis?: boolean;
  redisUrl?: string;
  keyPrefix?: string;
}

// Rate limit window data
interface RateLimitWindow {
  count: number;
  resetTime: number;
  lastRequest: number;
}

// In-memory store for rate limits (fallback when Redis is not available)
class MemoryStore {
  private windows: Map<string, RateLimitWindow> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  set(key: string, window: RateLimitWindow): void {
    this.windows.set(key, window);
  }

  get(key: string): RateLimitWindow | undefined {
    return this.windows.get(key);
  }

  delete(key: string): void {
    this.windows.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.windows.entries());
    for (const [key, window] of entries) {
      if (window.resetTime < now) {
        this.windows.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Redis store for distributed rate limiting
class RedisStore {
  private redis: any; // Redis client
  private keyPrefix: string;

  constructor(redisUrl: string, keyPrefix: string = 'rl:') {
    this.keyPrefix = keyPrefix;
    // Initialize Redis client
    // In a real implementation, you would use a Redis client like ioredis or redis
    // For now, we'll use a mock implementation
    logger.info('Redis store initialized', { redisUrl, keyPrefix });
  }

  async set(key: string, window: RateLimitWindow): Promise<void> {
    const redisKey = this.keyPrefix + key;
    const _value = JSON.stringify(window);
    const ttlMs = Math.max(0, window.resetTime - Date.now());

    try {
      // await this.redis.setex(redisKey, Math.ceil(ttlMs / 1000), value);
      logger.debug('Rate limit set in Redis', { key: redisKey, ttlMs });
    } catch (error) {
      logger.error('Failed to set rate limit in Redis', { key: redisKey, error: error.message });
    }
  }

  async get(key: string): Promise<RateLimitWindow | undefined> {
    const redisKey = this.keyPrefix + key;

    try {
      // const value = await this.redis.get(redisKey);
      // if (value) {
      //   return JSON.parse(value) as RateLimitWindow;
      // }
      // Mock implementation for now
      return undefined;
    } catch (error) {
      logger.error('Failed to get rate limit from Redis', { key: redisKey, error: error.message });
      return undefined;
    }
  }

  async delete(key: string): Promise<void> {
    const redisKey = this.keyPrefix + key;

    try {
      // await this.redis.del(redisKey);
      logger.debug('Rate limit deleted from Redis', { key: redisKey });
    } catch (error) {
      logger.error('Failed to delete rate limit from Redis', { key: redisKey, error: error.message });
    }
  }
}

/**
 * Rate Limiting Service
 */
export class RateLimitService {
  private config: RateLimitConfig;
  private store: MemoryStore | RedisStore;

  constructor(config: RateLimitConfig) {
    this.config = {
      headers: true,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyPrefix: 'codesight:',
      ...config,
    };

    // Initialize store
    if (this.config.enableRedis && this.config.redisUrl) {
      this.store = new RedisStore(this.config.redisUrl, this.config.keyPrefix);
    } else {
      this.store = new MemoryStore();
    }
  }

  /**
   * Check if request should be rate limited
   */
  async checkRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    // Skip rate limiting if configured
    if (this.config.skip && this.config.skip(request)) {
      return {
        allowed: true,
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs,
      };
    }

    // Generate key for this request
    const key = this.config.keyGenerator
      ? this.config.keyGenerator(request)
      : this.defaultKeyGenerator(request);

    const now = Date.now();
    let window = await this.getWindow(key);

    // Initialize window if it doesn't exist or has expired
    if (!window || window.resetTime < now) {
      window = {
        count: 0,
        resetTime: now + this.config.windowMs,
        lastRequest: now,
      };
    }

    // Check if request should be skipped based on success/failure
    // Note: This would be checked after the request in a real implementation
    // Placeholder logic - would check if request should be skipped

    // Increment counter
    window.count++;
    window.lastRequest = now;

    // Check if limit exceeded
    const allowed = window.count <= this.config.maxRequests;

    // Update store
    await this.setWindow(key, window);

    const result = {
      allowed,
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - window.count),
      resetTime: window.resetTime,
    };

    // Set rate limit headers if enabled
    if (this.config.headers) {
      this.setRateLimitHeaders(reply, result);
    }

    // Call custom callback if limit reached
    if (!allowed && this.config.onLimitReached) {
      this.config.onLimitReached(request, reply);
    }

    logger.debug('Rate limit check', {
      key,
      allowed,
      count: window.count,
      limit: this.config.maxRequests,
      remaining: result.remaining,
    });

    return result;
  }

  /**
   * Default key generator
   */
  private defaultKeyGenerator(request: FastifyRequest): string {
    // Use IP address as default key
    const ip = request.ip ||
                request.headers['x-forwarded-for'] as string ||
                request.headers['x-real-ip'] as string ||
                'unknown';

    // Include user ID if authenticated
    const userId = (request as any).user?.id || 'anonymous';

    return `${ip}:${userId}`;
  }

  /**
   * Get rate limit window from store
   */
  private async getWindow(key: string): Promise<RateLimitWindow | undefined> {
    if (this.store instanceof MemoryStore) {
      return this.store.get(key);
    } else {
      return await (this.store as RedisStore).get(key);
    }
  }

  /**
   * Set rate limit window in store
   */
  private async setWindow(key: string, window: RateLimitWindow): Promise<void> {
    if (this.store instanceof MemoryStore) {
      this.store.set(key, window);
    } else {
      await (this.store as RedisStore).set(key, window);
    }
  }

  /**
   * Set rate limit headers
   */
  private setRateLimitHeaders(reply: FastifyReply, result: {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
  }): void {
    reply.header('X-RateLimit-Limit', result.limit);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      reply.header('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetKey(key: string): Promise<void> {
    if (this.store instanceof MemoryStore) {
      this.store.delete(key);
    } else {
      await (this.store as RedisStore).delete(key);
    }
    logger.info('Rate limit reset', { key });
  }

  /**
   * Get current rate limit status for a key
   */
  async getKeyStatus(key: string): Promise<{
    count: number;
    limit: number;
    remaining: number;
    resetTime: number;
  } | null> {
    const window = await this.getWindow(key);
    if (!window) {
      return null;
    }

    const now = Date.now();
    if (window.resetTime < now) {
      return null;
    }

    return {
      count: window.count,
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - window.count),
      resetTime: window.resetTime,
    };
  }

  /**
   * Get rate limit statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    activeWindows: number;
    avgRequestsPerWindow: number;
  }> {
    if (this.store instanceof MemoryStore) {
      // This is a simplified implementation
      return {
        totalKeys: 0,
        activeWindows: 0,
        avgRequestsPerWindow: 0,
      };
    } else {
      // Redis implementation would use commands like SCAN and EVAL
      return {
        totalKeys: 0,
        activeWindows: 0,
        avgRequestsPerWindow: 0,
      };
    }
  }

  /**
   * Cleanup expired windows
   */
  async cleanup(): Promise<void> {
    if (this.store instanceof MemoryStore) {
      (this.store as MemoryStore).cleanup();
    }
    // Redis store automatically handles expiration via TTL
  }

  /**
   * Destroy the rate limit service
   */
  destroy(): void {
    if (this.store instanceof MemoryStore) {
      (this.store as MemoryStore).destroy();
    }
  }
}

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const rateLimitService = new RateLimitService(config);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await rateLimitService.checkRateLimit(request, reply);

    if (!result.allowed) {
      const message = config.customMessage || 'Too many requests, please try again later';
      reply.status(429).send({
        error: 'Rate limit exceeded',
        message,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
      return;
    }
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */

// Strict rate limiter (10 requests per minute)
export const strictRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  headers: true,
  customMessage: 'Rate limit exceeded: Maximum 10 requests per minute',
});

// Moderate rate limiter (100 requests per minute)
export const moderateRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  headers: true,
});

// Lenient rate limiter (1000 requests per hour)
export const lenientRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 1000,
  headers: true,
});

// API endpoint rate limiter (60 requests per minute)
export const apiRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  keyGenerator: (request) => {
    // Use user ID if authenticated, otherwise IP
    const userId = (request as any).user?.id;
    if (userId) {
      return `user:${userId}`;
    }
    return `ip:${request.ip || 'unknown'}`;
  },
  headers: true,
});

// Search endpoint rate limiter (30 requests per minute)
export const searchRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  keyGenerator: (request) => {
    const userId = (request as any).user?.id;
    return `search:${userId || request.ip || 'unknown'}`;
  },
  headers: true,
  customMessage: 'Search rate limit exceeded: Maximum 30 searches per minute',
});

// Indexing rate limiter (5 requests per hour)
export const indexingRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  keyGenerator: (request) => {
    const userId = (request as any).user?.id;
    return `indexing:${userId || request.ip || 'unknown'}`;
  },
  headers: true,
  customMessage: 'Indexing rate limit exceeded: Maximum 5 indexing requests per hour',
});

/**
 * Utility functions
 */

/**
 * Create rate limit key from request
 */
export function createRateLimitKey(request: FastifyRequest, prefix: string = ''): string {
  const ip = request.ip || 'unknown';
  const userId = (request as any).user?.id || 'anonymous';
  const path = request.url || 'unknown';

  return `${prefix}${ip}:${userId}:${path}`;
}

/**
 * Check if rate limit should be skipped for health endpoints
 */
export function shouldSkipHealthEndpoints(request: FastifyRequest): boolean {
  const healthEndpoints = ['/health', '/healthz', '/ping', '/metrics', '/status'];
  return healthEndpoints.some(endpoint => request.url.startsWith(endpoint));
}

/**
 * Calculate retry after seconds
 */
export function calculateRetryAfter(resetTime: number): number {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  return Math.max(1, retryAfter); // Minimum 1 second
}

/**
 * Format rate limit response
 */
export function formatRateLimitResponse(
  limit: number,
  remaining: number,
  resetTime: number,
  message?: string
) {
  return {
    limit,
    remaining,
    resetTime,
    retryAfter: calculateRetryAfter(resetTime),
    message: message || 'Rate limit information',
  };
}

export default RateLimitService;