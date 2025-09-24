import type { Request, Response, NextFunction } from 'express';

// Extended Request interface with custom properties
export interface ExtendedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  requestId?: string;
  startTime?: number;
  clientIp?: string;
  userAgent?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    resetTime: Date;
  };
  metrics?: {
    startTime: number;
    endTime?: number;
    duration?: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

// Middleware function type
export type MiddlewareFunction = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// Error handler middleware type
export type ErrorHandlerFunction = (
  error: Error,
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: ExtendedRequest) => string;
  onLimitReached?: (req: ExtendedRequest, res: Response) => void;
}

// Authentication configuration
export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn?: string | number;
  cookieName?: string;
  headerName?: string;
  skipPaths?: string[];
  requiredPermissions?: string[];
}

// CORS configuration
export interface CorsConfig {
  origin?: string | string[] | boolean | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

// Security configuration
export interface SecurityConfig {
  contentSecurityPolicy?: {
    directives?: Record<string, string[]>;
    reportOnly?: boolean;
  };
  hsts?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  noSniff?: boolean;
  frameguard?: {
    action?: 'deny' | 'sameorigin' | 'allow-from';
    domain?: string;
  };
  xssFilter?: boolean;
  referrerPolicy?: string;
}

// Logging configuration
export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'combined' | 'common' | 'short' | 'tiny';
  skipPaths?: string[];
  skipSuccessful?: boolean;
  includeBody?: boolean;
  maxBodyLength?: number;
  sensitiveFields?: string[];
}

// Metrics configuration
export interface MetricsConfig {
  collectMemoryUsage?: boolean;
  collectResponseTime?: boolean;
  collectRequestCount?: boolean;
  collectErrorRate?: boolean;
  skipPaths?: string[];
  buckets?: number[]; // For histogram buckets
}

// Validation configuration
export interface ValidationConfig {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  skipFunctions?: boolean;
}

// Error types
export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error {
  public details: any[];
  
  constructor(message = 'Validation failed', details: any[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class RateLimitError extends Error {
  public retryAfter: number;
  
  constructor(message = 'Rate limit exceeded', retryAfter = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

// Common response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: any;
  timestamp: string;
  requestId?: string;
  stack?: string; // Only in development
}

export interface PaginatedResponse<T = any> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  timestamp: string;
}

// Utility types
export type AsyncMiddleware = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => Promise<void>;

export type SyncMiddleware = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => void;

export type AnyMiddleware = AsyncMiddleware | SyncMiddleware;

// Middleware options
export interface MiddlewareOptions {
  skipPaths?: string[];
  skipMethods?: string[];
  enabled?: boolean;
  priority?: number;
}

// Request context
export interface RequestContext {
  requestId: string;
  startTime: number;
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  clientIp: string;
  userAgent: string;
  path: string;
  method: string;
  query: Record<string, any>;
  body: any;
  headers: Record<string, string>;
}

// Performance metrics
export interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  uptime: number;
  timestamp: string;
}

// Health check status
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: 'healthy' | 'unhealthy';
    rustCore: 'healthy' | 'unhealthy';
    llmService: 'healthy' | 'degraded' | 'unhealthy';
    fileSystem: 'healthy' | 'unhealthy';
  };
  metrics?: PerformanceMetrics;
}