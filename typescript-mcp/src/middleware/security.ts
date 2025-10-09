/**
 * Security Middleware
 * Provides CORS configuration and security headers for API protection
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { Logger } from '../services/logger';

const logger = new Logger('SecurityMiddleware');

// Security configuration
export interface SecurityConfig {
  // CORS configuration
  cors?: {
    origin: string | string[] | boolean;
    credentials?: boolean;
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
  };

  // Security headers
  securityHeaders?: {
    // Content Security Policy
    contentSecurityPolicy?: {
      directives?: Record<string, string[]>;
      reportOnly?: boolean;
    };

    // XSS Protection
    xssProtection?: boolean | string;

    // Frame protection
    frameGuard?: 'deny' | 'sameorigin' | 'allow-from';
    allowFrom?: string;

    // Content Type Options
    contentTypeOptions?: boolean;

    // Referrer Policy
    referrerPolicy?: string;

    // Permissions Policy
    permissionsPolicy?: string[];

    // Strict Transport Security
    hsts?: {
      maxAge?: number;
      includeSubDomains?: boolean;
      preload?: boolean;
    };

    // Custom headers
    customHeaders?: Record<string, string>;
  };

  // Rate limiting integration
  rateLimit?: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };

  // IP allowlist/blocklist
  ipFilter?: {
    allowlist?: string[];
    blocklist?: string[];
    trustedProxies?: string[];
  };

  // Request size limits
  requestLimits?: {
    maxRequestBodySize?: number;
    maxRequestHeaders?: number;
    maxHeaderSize?: number;
  };

  // Security features
  features?: {
    enableRequestId?: boolean;
    enableSecurityLogging?: boolean;
    enableIpDetection?: boolean;
    enableUserAgentDetection?: boolean;
  };
}

// Default security configuration
const defaultSecurityConfig: SecurityConfig = {
  cors: {
    origin: false, // No CORS by default
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: [],
    maxAge: 86400, // 24 hours
  },

  securityHeaders: {
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "https:"],
        "font-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
      },
      reportOnly: false,
    },

    xssProtection: '1; mode=block',
    frameGuard: 'deny',
    contentTypeOptions: true,
    referrerPolicy: 'strict-origin-when-cross-origin',

    permissionsPolicy: [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ],

    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: false,
    },
  },

  rateLimit: {
    enabled: true,
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
  },

  features: {
    enableRequestId: true,
    enableSecurityLogging: true,
    enableIpDetection: true,
    enableUserAgentDetection: true,
  },
};

/**
 * Security Service
 */
export class SecurityService {
  private config: SecurityConfig;
  private requestStore: Map<string, RequestInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: SecurityConfig = {}) {
    this.config = this.mergeConfig(defaultSecurityConfig, config);

    // Setup cleanup interval for request store
    this.cleanupInterval = setInterval(() => {
      this.cleanupRequestStore();
    }, 60 * 60 * 1000); // Clean up every hour
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(defaultConfig: SecurityConfig, userConfig: SecurityConfig): SecurityConfig {
    return {
      cors: { ...defaultConfig.cors, ...userConfig.cors },
      securityHeaders: { ...defaultConfig.securityHeaders, ...userConfig.securityHeaders },
      rateLimit: { ...defaultConfig.rateLimit, ...userConfig.rateLimit },
      ipFilter: { ...defaultConfig.ipFilter, ...userConfig.ipFilter },
      requestLimits: { ...defaultConfig.requestLimits, ...userConfig.requestLimits },
      features: { ...defaultConfig.features, ...userConfig.features },
    };
  }

  /**
   * Main security middleware
   */
  async handleRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const requestId = this.generateRequestId();
    (request as any).requestId = requestId;

    const requestInfo: RequestInfo = {
      id: requestId,
      ip: this.getClientIP(request),
      userAgent: request.headers['user-agent'] || 'unknown',
      method: request.method,
      url: request.url,
      timestamp: Date.now(),
    };

    // Store request info for security analysis
    this.requestStore.set(requestId, requestInfo);

    try {
      // IP filtering
      if (!this.checkIPFilter(requestInfo.ip)) {
        reply.status(403).send({
          error: 'Access denied',
          message: 'Your IP address is not allowed',
        });
        return;
      }

      // Request size validation
      if (!this.validateRequestSize(request)) {
        reply.status(413).send({
          error: 'Request too large',
          message: 'Request exceeds maximum allowed size',
        });
        return;
      }

      // CORS handling
      if (request.method === 'OPTIONS') {
        this.handleCORS(request, reply);
        return;
      }

      // Set security headers
      this.setSecurityHeaders(reply);

      // Log security events
      if (this.config.features?.enableSecurityLogging) {
        this.logSecurityEvent('request_received', requestInfo);
      }

    } catch (error) {
      logger.error('Security middleware error', {
        requestId,
        error: error.message,
        ip: requestInfo.ip,
      });

      reply.status(500).send({
        error: 'Internal security error',
        message: 'An error occurred in security processing',
      });
    }
  }

  /**
   * Handle CORS requests
   */
  private handleCORS(request: FastifyRequest, reply: FastifyReply): void {
    const corsConfig = this.config.cors;
    if (!corsConfig) return;

    const origin = request.headers.origin;
    const allowedOrigins = Array.isArray(corsConfig.origin)
      ? corsConfig.origin
      : [corsConfig.origin].filter(Boolean);

    // Check origin
    if (typeof corsConfig.origin === 'boolean') {
      if (corsConfig.origin) {
        reply.header('Access-Control-Allow-Origin', '*');
      }
    } else if (origin && allowedOrigins.includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
    } else if (allowedOrigins.includes('*')) {
      reply.header('Access-Control-Allow-Origin', '*');
    } else {
      reply.status(403).send({
        error: 'CORS error',
        message: 'Origin not allowed',
      });
      return;
    }

    // Set CORS headers
    if (corsConfig.credentials) {
      reply.header('Access-Control-Allow-Credentials', 'true');
    }

    if (corsConfig.methods) {
      reply.header('Access-Control-Allow-Methods', corsConfig.methods.join(', '));
    }

    if (corsConfig.allowedHeaders) {
      reply.header('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(', '));
    }

    if (corsConfig.exposedHeaders && corsConfig.exposedHeaders.length > 0) {
      reply.header('Access-Control-Expose-Headers', corsConfig.exposedHeaders.join(', '));
    }

    if (corsConfig.maxAge) {
      reply.header('Access-Control-Max-Age', corsConfig.maxAge.toString());
    }

    // Handle preflight request
    if (request.method === 'OPTIONS') {
      const statusCode = corsConfig.optionsSuccessStatus || 204;
      reply.status(statusCode).send();
      return;
    }
  }

  /**
   * Set security headers
   */
  private setSecurityHeaders(reply: FastifyReply): void {
    const headers = this.config.securityHeaders;
    if (!headers) return;

    // Content Security Policy
    if (headers.contentSecurityPolicy) {
      const csp = this.buildCSPHeader(headers.contentSecurityPolicy);
      if (headers.contentSecurityPolicy.reportOnly) {
        reply.header('Content-Security-Policy-Report-Only', csp);
      } else {
        reply.header('Content-Security-Policy', csp);
      }
    }

    // XSS Protection
    if (headers.xssProtection) {
      reply.header('X-XSS-Protection', headers.xssProtection.toString());
    }

    // Frame Protection
    if (headers.frameGuard) {
      switch (headers.frameGuard) {
        case 'deny':
          reply.header('X-Frame-Options', 'DENY');
          break;
        case 'sameorigin':
          reply.header('X-Frame-Options', 'SAMEORIGIN');
          break;
        case 'allow-from':
          if (headers.allowFrom) {
            reply.header('X-Frame-Options', `ALLOW-FROM ${headers.allowFrom}`);
          }
          break;
      }
    }

    // Content Type Options
    if (headers.contentTypeOptions) {
      reply.header('X-Content-Type-Options', 'nosniff');
    }

    // Referrer Policy
    if (headers.referrerPolicy) {
      reply.header('Referrer-Policy', headers.referrerPolicy);
    }

    // Permissions Policy
    if (headers.permissionsPolicy && headers.permissionsPolicy.length > 0) {
      reply.header('Permissions-Policy', headers.permissionsPolicy.join(', '));
    }

    // Strict Transport Security (HTTPS only)
    if (headers.hsts && this.isHTTPSConnection(reply)) {
      let hstsValue = `max-age=${headers.hsts.maxAge}`;
      if (headers.hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (headers.hsts.preload) {
        hstsValue += '; preload';
      }
      reply.header('Strict-Transport-Security', hstsValue);
    }

    // Custom headers
    if (headers.customHeaders) {
      for (const [name, value] of Object.entries(headers.customHeaders)) {
        reply.header(name, value);
      }
    }

    // Additional security headers
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    reply.header('X-Download-Options', 'noopen');
    reply.header('X-Robots-Tag', 'noindex, nofollow');
  }

  /**
   * Build CSP header value
   */
  private buildCSPHeader(csp: SecurityConfig['securityHeaders']['contentSecurityPolicy']): string {
    if (!csp?.directives) return '';

    const directives: string[] = [];

    for (const [name, values] of Object.entries(csp.directives)) {
      if (values.length > 0) {
        directives.push(`${name} ${values.join(' ')}`);
      }
    }

    return directives.join('; ');
  }

  /**
   * Check if connection is HTTPS
   */
  private isHTTPSConnection(reply: FastifyReply): boolean {
    // Check various ways to detect HTTPS
    return reply.request.headers['x-forwarded-proto'] === 'https' ||
           reply.request.protocol === 'https' ||
           reply.request.hostname === 'localhost'; // Allow localhost for development
  }

  /**
   * Check IP filter
   */
  private checkIPFilter(ip: string): boolean {
    const ipFilter = this.config.ipFilter;
    if (!ipFilter) return true;

    // Check blocklist first
    if (ipFilter.blocklist && ipFilter.blocklist.length > 0) {
      if (ipFilter.blocklist.some(blockedIP => this.matchesIP(ip, blockedIP))) {
        logger.warn('IP blocked', { ip });
        return false;
      }
    }

    // Check allowlist
    if (ipFilter.allowlist && ipFilter.allowlist.length > 0) {
      if (!ipFilter.allowlist.some(allowedIP => this.matchesIP(ip, allowedIP))) {
        logger.warn('IP not in allowlist', { ip });
        return false;
      }
    }

    return true;
  }

  /**
   * Check if IP matches pattern (supports CIDR notation)
   */
  private matchesIP(ip: string, pattern: string): boolean {
    // Simple implementation for exact matches
    // In production, you'd want proper CIDR support
    return ip === pattern || pattern === '0.0.0.0/0';
  }

  /**
   * Validate request size
   */
  private validateRequestSize(request: FastifyRequest): boolean {
    const limits = this.config.requestLimits;
    if (!limits) return true;

    // Check content length
    const contentLength = request.headers['content-length'];
    if (contentLength && limits.maxRequestBodySize) {
      const size = parseInt(contentLength, 10);
      if (size > limits.maxRequestBodySize) {
        logger.warn('Request too large', {
          ip: this.getClientIP(request),
          size,
          limit: limits.maxRequestBodySize,
        });
        return false;
      }
    }

    // Check header count
    const headerCount = Object.keys(request.headers).length;
    if (limits.maxRequestHeaders && headerCount > limits.maxRequestHeaders) {
      logger.warn('Too many headers', {
        ip: this.getClientIP(request),
        headerCount,
        limit: limits.maxRequestHeaders,
      });
      return false;
    }

    return true;
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: FastifyRequest): string {
    const ip = request.ip ||
              request.headers['x-forwarded-for'] as string ||
              request.headers['x-real-ip'] as string ||
              request.headers['x-client-ip'] as string ||
              'unknown';

    // Handle multiple IPs in x-forwarded-for
    if (ip.includes(',')) {
      return ip.split(',')[0].trim();
    }

    return ip;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log security events
   */
  private logSecurityEvent(event: string, requestInfo: RequestInfo): void {
    logger.info('Security event', {
      event,
      requestId: requestInfo.id,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      method: requestInfo.method,
      url: requestInfo.url,
      timestamp: new Date(requestInfo.timestamp).toISOString(),
    });
  }

  /**
   * Clean up old request info
   */
  private cleanupRequestStore(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [id, info] of this.requestStore.entries()) {
      if (now - info.timestamp > maxAge) {
        this.requestStore.delete(id);
      }
    }
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalRequests: number;
    activeIPs: number;
    topUserAgents: Array<{ agent: string; count: number }>;
    requestRate: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const recentRequests = Array.from(this.requestStore.values())
      .filter(info => info.timestamp > oneHourAgo);

    const ipCounts = new Map<string, number>();
    const userAgentCounts = new Map<string, number>();

    for (const request of recentRequests) {
      ipCounts.set(request.ip, (ipCounts.get(request.ip) || 0) + 1);
      userAgentCounts.set(
        request.userAgent,
        (userAgentCounts.get(request.userAgent) || 0) + 1
      );
    }

    const topUserAgents = Array.from(userAgentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([agent, count]) => ({ agent, count }));

    return {
      totalRequests: this.requestStore.size,
      activeIPs: ipCounts.size,
      topUserAgents,
      requestRate: recentRequests.length, // requests per hour
    };
  }

  /**
   * Detect suspicious activity
   */
  detectSuspiciousActivity(): {
    suspiciousIPs: string[];
    suspiciousUserAgents: string[];
    potentialAttacks: Array<{ type: string; ip: string; count: number }>;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentRequests = Array.from(this.requestStore.values())
      .filter(info => info.timestamp > oneHourAgo);

    const ipCounts = new Map<string, number>();
    const userAgentCounts = new Map<string, number>();

    for (const request of recentRequests) {
      ipCounts.set(request.ip, (ipCounts.get(request.ip) || 0) + 1);
      userAgentCounts.set(
        request.userAgent,
        (userAgentCounts.get(request.userAgent) || 0) + 1
      );
    }

    // Detect suspicious IPs (high request rate)
    const avgRequestsPerIP = recentRequests.length / Math.max(ipCounts.size, 1);
    const suspiciousThreshold = avgRequestsPerIP * 10;
    const suspiciousIPs = Array.from(ipCounts.entries())
      .filter(([, count]) => count > suspiciousThreshold)
      .map(([ip]) => ip);

    // Detect suspicious user agents
    const suspiciousUserAgents = Array.from(userAgentCounts.entries())
      .filter(([agent]) =>
        agent.includes('bot') ||
        agent.includes('crawler') ||
        agent.includes('scanner') ||
        agent.length < 10 // Very short user agents
      )
      .map(([agent]) => agent);

    // Detect potential attacks
    const potentialAttacks = [
      {
        type: 'rate_limit_exceeded',
        ips: suspiciousIPs,
        threshold: suspiciousThreshold,
      },
      {
        type: 'suspicious_user_agents',
        agents: suspiciousUserAgents,
      },
    ];

    return {
      suspiciousIPs,
      suspiciousUserAgents,
      potentialAttacks: potentialAttacks.map(attack => ({
        type: attack.type,
        ip: attack.ips?.[0] || 'unknown',
        count: Array.isArray(attack.ips) ? attack.ips.length : 0,
      })),
    };
  }

  /**
   * Destroy the security service
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requestStore.clear();
  }
}

// Request information interface
interface RequestInfo {
  id: string;
  ip: string;
  userAgent: string;
  method: string;
  url: string;
  timestamp: number;
}

/**
 * Create security middleware
 */
export function createSecurityMiddleware(config: SecurityConfig = {}) {
  const securityService = new SecurityService(config);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    await securityService.handleRequest(request, reply);
  };
}

/**
 * Pre-configured security middleware presets
 */

// Development security (more permissive)
export const developmentSecurity = createSecurityMiddleware({
  cors: {
    origin: true, // Allow all origins in development
    credentials: true,
  },
  securityHeaders: {
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        "connect-src": ["'self'", "ws:", "wss:"],
      },
      reportOnly: true,
    },
    hsts: undefined, // No HSTS in development
  },
  rateLimit: {
    enabled: false, // No rate limiting in development
  },
});

// Production security (strict)
export const productionSecurity = createSecurityMiddleware({
  cors: {
    origin: [], // No CORS by default in production
    credentials: false,
  },
  securityHeaders: {
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },
  rateLimit: {
    enabled: true,
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
  },
});

// API security (for API endpoints)
export const apiSecurity = createSecurityMiddleware({
  cors: {
    origin: false,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  },
  securityHeaders: {
    contentSecurityPolicy: undefined, // No CSP needed for APIs
    customHeaders: {
      'X-API-Version': '1.0.0',
      'X-Powered-By': 'CodeSight MCP',
    },
  },
  rateLimit: {
    enabled: true,
    windowMs: 15 * 60 * 1000,
    maxRequests: 1000,
  },
});

export default SecurityService;