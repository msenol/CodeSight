/**
 * JWT Authentication Middleware
 * Provides secure token-based authentication for API endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { Logger } from '../services/logger';

const logger = new Logger('AuthMiddleware');

// JWT Secret from environment or fallback
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_ALGORITHM = 'HS256';
const DEFAULT_TOKEN_EXPIRY = '24h';

// Token types
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

// User roles
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer',
}

// JWT Payload interface
export interface JWTPayload {
  sub: string; // Subject (user ID)
  email: string;
  role: UserRole;
  permissions: string[];
  tokenType: TokenType;
  iat?: number; // Issued at
  exp?: number; // Expiration
  iss?: string; // Issuer
  aud?: string; // Audience
}

// Authentication options
export interface AuthOptions {
  required?: boolean;
  roles?: UserRole[];
  permissions?: string[];
  skipPaths?: string[];
  refreshEnabled?: boolean;
  issuer?: string;
  audience?: string;
}

// Token generation options
export interface TokenOptions {
  userId: string;
  email: string;
  role: UserRole;
  permissions: string[];
  expiresIn?: string | number;
  tokenType?: TokenType;
  issuer?: string;
  audience?: string;
}

// Token pair (access + refresh)
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Authentication result
export interface AuthResult {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    role: UserRole;
    permissions: string[];
  };
  error?: string;
}

/**
 * JWT Authentication Service
 */
export class JWTAuthService {
  private secret: string;
  private defaultOptions: AuthOptions;

  constructor(secret?: string, defaultOptions: AuthOptions = {}) {
    this.secret = secret || JWT_SECRET;
    this.defaultOptions = {
      required: true,
      roles: [],
      permissions: [],
      skipPaths: ['/health', '/metrics', '/docs'],
      refreshEnabled: true,
      ...defaultOptions,
    };
  }

  /**
   * Generate JWT token
   */
  generateToken(options: TokenOptions): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = options.expiresIn || DEFAULT_TOKEN_EXPIRY;

    // Calculate expiration time
    let exp: number;
    if (typeof expiresIn === 'string') {
      // Parse duration strings like '24h', '7d', '30m'
      exp = this.parseDuration(expiresIn) + now;
    } else {
      exp = expiresIn + now;
    }

    const payload: Omit<JWTPayload, 'iat'> = {
      sub: options.userId,
      email: options.email,
      role: options.role,
      permissions: options.permissions,
      tokenType: options.tokenType || TokenType.ACCESS,
      exp,
      iss: options.issuer,
      aud: options.audience,
    };

    return jwt.sign(payload, this.secret, {
      algorithm: JWT_ALGORITHM,
      issuer: options.issuer,
      audience: options.audience,
    });
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(options: TokenOptions): TokenPair {
    const accessToken = this.generateToken({
      ...options,
      tokenType: TokenType.ACCESS,
      expiresIn: '15m', // Short-lived access token
    });

    const refreshToken = this.generateToken({
      ...options,
      tokenType: TokenType.REFRESH,
      expiresIn: '7d', // Long-lived refresh token
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string, options: { issuer?: string; audience?: string } = {}): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: [JWT_ALGORITHM],
        issuer: options.issuer,
        audience: options.audience,
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  refreshToken(refreshToken: string, options: { issuer?: string; audience?: string } = {}): TokenPair {
    try {
      // Verify refresh token
      const decoded = this.verifyToken(refreshToken, options);

      if (decoded.tokenType !== TokenType.REFRESH) {
        throw new Error('Invalid refresh token');
      }

      // Generate new token pair
      return this.generateTokenPair({
        userId: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions,
        issuer: options.issuer,
        audience: options.audience,
      });
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Extract token from request headers
   */
  extractToken(request: FastifyRequest): string | null {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return null;
    }

    // Support both "Bearer token" and "token" formats
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return authHeader;
  }

  /**
   * Authenticate request
   */
  async authenticateRequest(
    request: FastifyRequest,
    options: AuthOptions = {}
  ): Promise<AuthResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    // Check if path should be skipped
    if (mergedOptions.skipPaths?.includes(request.url)) {
      return { authenticated: false };
    }

    // Extract token
    const token = this.extractToken(request);

    if (!token) {
      if (mergedOptions.required) {
        return { authenticated: false, error: 'No authentication token provided' };
      }
      return { authenticated: false };
    }

    try {
      // Verify token
      const payload = this.verifyToken(token, {
        issuer: mergedOptions.issuer,
        audience: mergedOptions.audience,
      });

      // Check token type
      if (payload.tokenType !== TokenType.ACCESS) {
        return { authenticated: false, error: 'Invalid token type' };
      }

      // Check role requirements
      if (mergedOptions.roles && mergedOptions.roles.length > 0) {
        if (!mergedOptions.roles.includes(payload.role)) {
          return {
            authenticated: false,
            error: `Insufficient role. Required: ${mergedOptions.roles.join(', ')}, Current: ${payload.role}`
          };
        }
      }

      // Check permission requirements
      if (mergedOptions.permissions && mergedOptions.permissions.length > 0) {
        const hasPermission = mergedOptions.permissions.some(requiredPermission =>
          payload.permissions.includes(requiredPermission)
        );

        if (!hasPermission) {
          return {
            authenticated: false,
            error: `Insufficient permissions. Required: ${mergedOptions.permissions.join(', ')}`
          };
        }
      }

      return {
        authenticated: true,
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          permissions: payload.permissions,
        },
      };
    } catch (error) {
      logger.warn('Authentication failed', { error: error.message, url: request.url });
      return { authenticated: false, error: `Authentication failed: ${error.message}` };
    }
  }

  /**
   * Create authentication middleware
   */
  createMiddleware(options: AuthOptions = {}) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const authResult = await this.authenticateRequest(request, options);

      if (!authResult.authenticated) {
        if (options.required !== false) {
          const statusCode = authResult.error?.includes('expired') ? 401 : 403;
          return reply.status(statusCode).send({
            error: 'Authentication required',
            message: authResult.error || 'Invalid or missing authentication token',
          });
        }
      }

      // Attach user info to request
      if (authResult.user) {
        request.user = authResult.user;
      }
    };
  }

  /**
   * Parse duration string to seconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * multipliers[unit];
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      return decoded;
    } catch (error) {
      logger.error('Token decode failed', { error: error.message });
      return null;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true;
    }

    return expiration < new Date();
  }

  /**
   * Create authorization scope
   */
  createScope(role: UserRole, permissions: string[] = []): string {
    return `${role}:${permissions.join(',')}`;
  }

  /**
   * Parse authorization scope
   */
  parseScope(scope: string): { role: UserRole; permissions: string[] } {
    const [role, permissionsStr] = scope.split(':');

    return {
      role: role as UserRole,
      permissions: permissionsStr ? permissionsStr.split(',').filter(p => p.length > 0) : [],
    };
  }
}

// Extend FastifyRequest to include user property
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: UserRole;
      permissions: string[];
    };
  }
}

// Default auth service instance
export const defaultAuthService = new JWTAuthService();

/**
 * Pre-configured middleware for common use cases
 */

// Require authentication
export const requireAuth = defaultAuthService.createMiddleware({ required: true });

// Require admin role
export const requireAdmin = defaultAuthService.createMiddleware({
  required: true,
  roles: [UserRole.ADMIN],
});

// Require user role or higher
export const requireUser = defaultAuthService.createMiddleware({
  required: true,
  roles: [UserRole.USER, UserRole.ADMIN],
});

// Optional authentication (attach user if token provided, but don't require it)
export const optionalAuth = defaultAuthService.createMiddleware({ required: false });

/**
 * Utility functions
 */

/**
 * Generate authentication response headers
 */
export function setAuthHeaders(reply: FastifyReply, tokenPair: TokenPair): void {
  reply.header('Authorization', `Bearer ${tokenPair.accessToken}`);
  reply.header('X-Refresh-Token', tokenPair.refreshToken);
  reply.header('X-Token-Expires-In', tokenPair.expiresIn.toString());
}

/**
 * Clear authentication headers
 */
export function clearAuthHeaders(reply: FastifyReply): void {
  reply.header('Authorization', '');
  reply.header('X-Refresh-Token', '');
  reply.header('X-Token-Expires-In', '');
}

/**
 * Authentication error handler
 */
export function handleAuthError(error: Error, reply: FastifyReply): void {
  if (error.message.includes('Token verification failed')) {
    reply.status(401).send({
      error: 'Authentication failed',
      message: 'Invalid or expired token',
    });
  } else if (error.message.includes('Insufficient')) {
    reply.status(403).send({
      error: 'Authorization failed',
      message: error.message,
    });
  } else {
    reply.status(500).send({
      error: 'Authentication error',
      message: 'An unexpected error occurred during authentication',
    });
  }
}

export default JWTAuthService;