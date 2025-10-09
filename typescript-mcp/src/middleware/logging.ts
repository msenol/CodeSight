/**
 * Request/Response Logging Middleware
 * Provides comprehensive logging for API requests and responses with structured output
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { Logger } from '../services/logger';
import { randomUUID } from 'crypto';

const logger = new Logger('LoggingMiddleware');

// Logging configuration
export interface LoggingConfig {
  enabled?: boolean;
  level?: 'debug' | 'info' | 'warn' | 'error';
  format?: 'json' | 'text';
  includeBody?: boolean;
  includeHeaders?: boolean;
  maxBodySize?: number;
  sensitiveHeaders?: string[];
  sensitiveFields?: string[];
  excludePaths?: string[];
  includeQueryParams?: boolean;
  includeUser?: boolean;
  includeDuration?: boolean;
  slowQueryThreshold?: number;
  logRequestBody?: boolean;
  logResponseBody?: boolean;
  customFields?: Array<(request: FastifyRequest, reply: FastifyReply) => Record<string, any>>;
}

// Default logging configuration
const defaultLoggingConfig: LoggingConfig = {
  enabled: true,
  level: 'info',
  format: 'json',
  includeBody: false,
  includeHeaders: true,
  maxBodySize: 1024, // 1KB
  sensitiveHeaders: [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'x-session-token',
  ],
  sensitiveFields: [
    'password',
    'token',
    'secret',
    'key',
    'credential',
    'auth',
  ],
  excludePaths: [
    '/health',
    '/ping',
    '/metrics',
    '/favicon.ico',
  ],
  includeQueryParams: true,
  includeUser: true,
  includeDuration: true,
  slowQueryThreshold: 1000, // 1 second
  logRequestBody: false,
  logResponseBody: false,
};

// Request log entry
interface RequestLogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  url: string;
  path: string;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  ip?: string;
  userAgent?: string;
  userId?: string;
  userRole?: string;
  startTime: number;
}

// Response log entry
interface ResponseLogEntry extends RequestLogEntry {
  statusCode: number;
  statusMessage?: string;
  responseTime: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  contentLength?: number;
  error?: string;
  stack?: string;
}

// Log statistics
interface LogStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  slowRequests: number;
  topEndpoints: Array<{ path: string; count: number; avgResponseTime: number }>;
  errorDistribution: Record<string, number>;
}

/**
 * Logging Service
 */
export class LoggingService {
  private config: LoggingConfig;
  private stats: LogStats;
  private endpointStats: Map<string, { count: number; totalTime: number }> = new Map();

  constructor(config: LoggingConfig = {}) {
    this.config = { ...defaultLoggingConfig, ...config };
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      topEndpoints: [],
      errorDistribution: {},
    };
  }

  /**
   * Create logging middleware
   */
  createMiddleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!this.config.enabled) {
        return;
      }

      const requestId = this.generateRequestId();
      const startTime = Date.now();

      // Attach request ID to request for tracking
      (request as any).requestId = requestId;

      // Log request
      const requestLog = this.createRequestLog(request, requestId, startTime);
      this.logRequest(requestLog);

      // Hook into response
      const originalSend = reply.send.bind(reply);
      reply.send = (payload: any) => {
        const responseTime = Date.now() - startTime;

        // Create response log
        const responseLog = this.createResponseLog(
          request,
          reply,
          requestId,
          startTime,
          responseTime,
          payload
        );

        this.logResponse(responseLog);
        this.updateStats(responseLog);

        return originalSend(payload);
      };

      // Handle response errors
      reply.addHook('onError', (request, reply, error) => {
        const responseTime = Date.now() - startTime;

        const responseLog = this.createResponseLog(
          request,
          reply,
          requestId,
          startTime,
          responseTime,
          null,
          error
        );

        this.logResponse(responseLog);
        this.updateStats(responseLog);
      });
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return randomUUID().replace(/-/g, '');
  }

  /**
   * Create request log entry
   */
  private createRequestLog(
    request: FastifyRequest,
    requestId: string,
    startTime: number
  ): RequestLogEntry {
    const log: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      method: request.method,
      url: request.url,
      path: request.url.split('?')[0],
      startTime,
    };

    // Add query parameters
    if (this.config.includeQueryParams && request.query) {
      log.query = this.sanitizeObject(request.query);
    }

    // Add headers
    if (this.config.includeHeaders && request.headers) {
      log.headers = this.sanitizeHeaders(request.headers);
    }

    // Add body (if enabled and small enough)
    if (this.config.includeBody && request.body) {
      log.body = this.sanitizeBody(request.body);
    }

    // Add IP and user agent
    log.ip = this.getClientIP(request);
    log.userAgent = request.headers['user-agent'];

    // Add user information
    if (this.config.includeUser && (request as any).user) {
      const user = (request as any).user;
      log.userId = user.id;
      log.userRole = user.role;
    }

    // Add custom fields
    if (this.config.customFields) {
      for (const customField of this.config.customFields) {
        try {
          const customData = customField(request, {} as FastifyReply);
          Object.assign(log, customData);
        } catch (error) {
          logger.warn('Failed to generate custom logging field', {
            requestId,
            error: error.message,
          });
        }
      }
    }

    return log;
  }

  /**
   * Create response log entry
   */
  private createResponseLog(
    request: FastifyRequest,
    reply: FastifyReply,
    requestId: string,
    startTime: number,
    responseTime: number,
    payload: any,
    error?: Error
  ): ResponseLogEntry {
    const log: ResponseLogEntry = {
      ...this.createRequestLog(request, requestId, startTime),
      statusCode: reply.statusCode,
      responseTime,
    };

    // Add status message
    if (reply.raw.statusMessage) {
      log.statusMessage = reply.raw.statusMessage;
    }

    // Add response headers
    if (this.config.includeHeaders && reply.getHeaders()) {
      log.responseHeaders = this.sanitizeHeaders(reply.getHeaders());
    }

    // Add response body (if enabled)
    if (this.config.logResponseBody && payload) {
      log.responseBody = this.sanitizeBody(payload);
    }

    // Add content length
    const contentLength = reply.getHeader('content-length');
    if (contentLength) {
      log.contentLength = parseInt(contentLength as string, 10);
    }

    // Add error information
    if (error) {
      log.error = error.message;
      log.stack = error.stack;
    }

    // Add duration flag
    if (this.config.includeDuration) {
      log.slow = responseTime > (this.config.slowQueryThreshold || 1000);
    }

    return log;
  }

  /**
   * Log request entry
   */
  private logRequest(log: RequestLogEntry): void {
    const logData = {
      type: 'request',
      ...log,
    };

    if (this.config.format === 'json') {
      logger.info('Request received', logData);
    } else {
      logger.info(`${log.method} ${log.path} - Request started`, {
        requestId: log.requestId,
        ip: log.ip,
        userAgent: log.userAgent,
      });
    }
  }

  /**
   * Log response entry
   */
  private logResponse(log: ResponseLogEntry): void {
    const logData = {
      type: 'response',
      ...log,
    };

    const isError = log.statusCode >= 400;
    const isSlow = log.responseTime > (this.config.slowQueryThreshold || 1000);

    let logLevel: 'info' | 'warn' | 'error' = 'info';
    if (isError) {
      logLevel = log.statusCode >= 500 ? 'error' : 'warn';
    } else if (isSlow) {
      logLevel = 'warn';
    }

    if (this.config.format === 'json') {
      logger[logLevel]('Request completed', logData);
    } else {
      const message = `${log.method} ${log.path} - ${log.statusCode} (${log.responseTime}ms)`;

      if (isError) {
        logger[logLevel](message, {
          requestId: log.requestId,
          error: log.error,
        });
      } else if (isSlow) {
        logger[logLevel](`${message} - SLOW REQUEST`, {
          requestId: log.requestId,
          responseTime: log.responseTime,
        });
      } else {
        logger.info(message, {
          requestId: log.requestId,
        });
      }
    }
  }

  /**
   * Update statistics
   */
  private updateStats(log: ResponseLogEntry): void {
    this.stats.totalRequests++;

    if (log.statusCode < 400) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;

      // Track error distribution
      const statusRange = `${Math.floor(log.statusCode / 100)}xx`;
      this.stats.errorDistribution[statusRange] =
        (this.stats.errorDistribution[statusRange] || 0) + 1;
    }

    // Update average response time
    const totalTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1) + log.responseTime;
    this.stats.averageResponseTime = totalTime / this.stats.totalRequests;

    // Track slow requests
    if (log.responseTime > (this.config.slowQueryThreshold || 1000)) {
      this.stats.slowRequests++;
    }

    // Update endpoint statistics
    const endpointStats = this.endpointStats.get(log.path) || { count: 0, totalTime: 0 };
    endpointStats.count++;
    endpointStats.totalTime += log.responseTime;
    this.endpointStats.set(log.path, endpointStats);

    // Update top endpoints periodically
    if (this.stats.totalRequests % 100 === 0) {
      this.updateTopEndpoints();
    }
  }

  /**
   * Update top endpoints list
   */
  private updateTopEndpoints(): void {
    this.stats.topEndpoints = Array.from(this.endpointStats.entries())
      .map(([path, stats]) => ({
        path,
        count: stats.count,
        avgResponseTime: stats.totalTime / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Sanitize headers by removing sensitive information
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = this.config.sensitiveHeaders || [];

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveHeaders.some(sensitive => lowerKey.includes(sensitive.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Sanitize object by removing sensitive fields
   */
  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sensitiveFields = this.config.sensitiveFields || [];
    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(sensitive => lowerKey.includes(sensitive.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize body with size limit
   */
  private sanitizeBody(body: any): any {
    if (!body) {
      return null;
    }

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const maxSize = this.config.maxBodySize || 1024;

    if (bodyString.length > maxSize) {
      return {
        type: typeof body === 'string' ? 'string' : 'object',
        size: bodyString.length,
        truncated: true,
        preview: bodyString.substring(0, maxSize) + '...[TRUNCATED]',
      };
    }

    return this.sanitizeObject(body);
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: FastifyRequest): string {
    return request.ip ||
           request.headers['x-forwarded-for'] as string ||
           request.headers['x-real-ip'] as string ||
           'unknown';
  }

  /**
   * Get current statistics
   */
  getStats(): LogStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      topEndpoints: [],
      errorDistribution: {},
    };
    this.endpointStats.clear();
  }

  /**
   * Create custom field extractor
   */
  static createCustomField(extractor: (request: FastifyRequest, reply: FastifyReply) => Record<string, any>) {
    return extractor;
  }

  /**
   * Create custom fields for common scenarios
   */
  static createCommonCustomFields(): Array<(request: FastifyRequest, reply: FastifyReply) => Record<string, any>> {
    return [
      // Request size
      (request, reply) => ({
        requestSize: JSON.stringify(request.body || '').length,
        responseSize: parseInt(reply.getHeader('content-length') as string || '0', 10),
      }),

      // Geographic info (if available)
      (request, reply) => {
        const country = request.headers['x-country-code'] as string;
        const region = request.headers['x-region'] as string;
        return {
          country: country || 'unknown',
          region: region || 'unknown',
        };
      },

      // Device info
      (request, reply) => {
        const userAgent = request.headers['user-agent'] || '';
        const isMobile = /mobile|android|iphone/i.test(userAgent);
        const isBot = /bot|crawler|spider|scraper/i.test(userAgent);

        return {
          isMobile,
          isBot,
          device: isMobile ? 'mobile' : 'desktop',
        };
      },

      // API version
      (request, reply) => ({
        apiVersion: request.headers['x-api-version'] || '1.0.0',
      }),
    ];
  }
}

/**
 * Pre-configured logging middleware presets
 */

// Development logging (verbose, includes bodies)
export const developmentLogging = new LoggingService({
  enabled: true,
  level: 'debug',
  format: 'json',
  includeBody: true,
  logRequestBody: true,
  logResponseBody: true,
  maxBodySize: 10240, // 10KB
  slowQueryThreshold: 500, // 500ms
  customFields: LoggingService.createCommonCustomFields(),
});

// Production logging (structured, minimal)
export const productionLogging = new LoggingService({
  enabled: true,
  level: 'info',
  format: 'json',
  includeBody: false,
  logRequestBody: false,
  logResponseBody: false,
  slowQueryThreshold: 2000, // 2 seconds
  customFields: LoggingService.createCommonCustomFields(),
});

// API logging (focused on API metrics)
export const apiLogging = new LoggingService({
  enabled: true,
  level: 'info',
  format: 'json',
  includeHeaders: false,
  includeBody: false,
  slowQueryThreshold: 1000,
  customFields: [
    ...LoggingService.createCommonCustomFields(),
    // API-specific fields
    (request, reply) => ({
      endpoint: `${request.method} ${request.url.split('?')[0]}`,
      success: reply.statusCode < 400,
    }),
  ],
});

// Security logging (focused on security events)
export const securityLogging = new LoggingService({
  enabled: true,
  level: 'warn',
  format: 'json',
  includeHeaders: true,
  includeQueryParams: true,
  customFields: [
    // Security-focused fields
    (request, reply) => ({
      suspiciousActivity: this.detectSuspiciousActivity(request),
      authRequired: this.requiresAuthentication(request.url),
      rateLimitExceeded: reply.statusCode === 429,
    }),
  ],
});

/**
 * Utility functions for security logging
 */
function detectSuspiciousActivity(request: FastifyRequest): boolean {
  const userAgent = request.headers['user-agent'] || '';
  const suspiciousPatterns = [
    /bot|crawler|scanner|sqlmap/i,
    /<script|javascript:|data:\/\//i,
    /\.\./,  // Path traversal
  ];

  return suspiciousPatterns.some(pattern => pattern.test(userAgent)) ||
         request.url.includes('../') ||
         request.url.length > 2048;
}

function requiresAuthentication(url: string): boolean {
  const protectedPaths = [
    '/api/admin',
    '/api/user',
    '/api/codebases',
    '/api/queries',
  ];

  return protectedPaths.some(path => url.startsWith(path));
}

/**
 * Create logging middleware with configuration
 */
export function createLoggingMiddleware(config: LoggingConfig = {}) {
  const loggingService = new LoggingService(config);
  return loggingService.createMiddleware();
}

export default LoggingService;