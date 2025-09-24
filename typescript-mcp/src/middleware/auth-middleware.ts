import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import type { Response, NextFunction } from 'express';
import type { ExtendedRequest, AuthConfig } from './types.js';
import { HTTP_STATUS } from './types.js';
import { AuthenticationError, AuthorizationError } from './types.js';

const defaultConfig: AuthConfig = {
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  jwtExpiresIn: '24h',
  cookieName: 'auth-token',
  headerName: 'authorization',
  skipPaths: ['/api/health', '/api/status', '/api/docs'],
  requiredPermissions: []
};

export class AuthMiddleware {
  private config: AuthConfig;

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Main authentication middleware
   */
  authenticate = async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip authentication for certain paths
      if (this.shouldSkipPath(req.path)) {
        return next();
      }

      const token = this.extractToken(req);
      
      if (!token) {
        throw new AuthenticationError('No authentication token provided');
      }

      const decoded = this.verifyToken(token);
      req.user = decoded;

      next();
    } catch (error) {
      this.handleAuthError(error, res);
    }
  };

  /**
   * Authorization middleware - checks if user has required permissions
   */
  authorize = (requiredPermissions: string[] = []) => {
    return async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AuthenticationError('User not authenticated');
        }

        const userPermissions = req.user.permissions || [];
        const hasPermission = requiredPermissions.every(permission => 
          userPermissions.includes(permission) || userPermissions.includes('admin')
        );

        if (!hasPermission) {
          throw new AuthorizationError(
            `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
          );
        }

        next();
      } catch (error) {
        this.handleAuthError(error, res);
      }
    };
  };

  /**
   * Role-based authorization middleware
   */
  requireRole = (requiredRoles: string[]) => {
    return async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AuthenticationError('User not authenticated');
        }

        const userRole = req.user.role;
        if (!requiredRoles.includes(userRole)) {
          throw new AuthorizationError(
            `Insufficient role. Required: ${requiredRoles.join(' or ')}, Current: ${userRole}`
          );
        }

        next();
      } catch (error) {
        this.handleAuthError(error, res);
      }
    };
  };

  /**
   * Optional authentication - doesn't fail if no token provided
   */
  optionalAuth = async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (token) {
        try {
          const decoded = this.verifyToken(token);
          req.user = decoded;
        } catch (error) {
          // Ignore token verification errors for optional auth
          console.warn('Optional auth token verification failed:', error);
        }
      }

      next();
    } catch (error) {
      // For optional auth, we don't want to block the request
      next();
    }
  };

  /**
   * API key authentication middleware
   */
  apiKeyAuth = (validApiKeys: string[]) => {
    return async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const apiKey = req.headers['x-api-key'] as string;
        
        if (!apiKey) {
          throw new AuthenticationError('API key required');
        }

        if (!validApiKeys.includes(apiKey)) {
          throw new AuthenticationError('Invalid API key');
        }

        // Set a basic user object for API key authentication
        req.user = {
          id: 'api-user',
          email: 'api@system.local',
          role: 'api',
          permissions: ['api_access']
        };

        next();
      } catch (error) {
        this.handleAuthError(error, res);
      }
    };
  };

  /**
   * Generate JWT token
   */
  generateToken = (payload: any): string => {
    const options: SignOptions = {
      expiresIn: this.config.jwtExpiresIn as StringValue | number
    };
    return jwt.sign(payload, this.config.jwtSecret as string, options);
  };

  /**
   * Verify JWT token
   */
  verifyToken = (token: string): any => {
    try {
      return jwt.verify(token, this.config.jwtSecret as string);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      } else {
        throw new AuthenticationError('Token verification failed');
      }
    }
  };

  /**
   * Extract token from request
   */
  private extractToken(req: ExtendedRequest): string | null {
    // Try to get token from Authorization header
    const authHeader = req.headers[this.config.headerName!] as string;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try to get token from cookie
    const cookieToken = req.cookies?.[this.config.cookieName!];
    if (cookieToken) {
      return cookieToken;
    }

    // Try to get token from query parameter (not recommended for production)
    const queryToken = req.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }

  /**
   * Check if path should skip authentication
   */
  private shouldSkipPath(path: string): boolean {
    return this.config.skipPaths?.some(skipPath => {
      if (skipPath.endsWith('*')) {
        return path.startsWith(skipPath.slice(0, -1));
      }
      return path === skipPath;
    }) || false;
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: any, res: Response): void {
    console.error('Authentication error:', error);

    if (error instanceof AuthenticationError) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Authentication failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else if (error instanceof AuthorizationError) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: 'Authorization failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred during authentication',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Refresh token middleware
   */
  refreshToken = async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        throw new AuthenticationError('No token provided for refresh');
      }

      // Verify the token (even if expired, we want to check if it's valid)
      let decoded;
      try {
        decoded = jwt.verify(token, this.config.jwtSecret as string);
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          // For expired tokens, we can still decode them to get the payload
          decoded = jwt.decode(token);
        } else {
          throw new AuthenticationError('Invalid token for refresh');
        }
      }

      if (!decoded || typeof decoded !== 'object') {
        throw new AuthenticationError('Invalid token payload');
      }

      // Generate new token with same payload (minus exp, iat)
      const { exp, iat, ...payload } = decoded;
      const newToken = this.generateToken(payload);

      // Set the new token in response header
      res.setHeader('X-New-Token', newToken);
      
      // Update request user
      req.user = payload;

      next();
    } catch (error) {
      this.handleAuthError(error, res);
    }
  };

  /**
   * Logout middleware - invalidates token
   */
  logout = async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Clear cookie if using cookie authentication
      if (this.config.cookieName) {
        res.clearCookie(this.config.cookieName);
      }

      // In a real implementation, you might want to add the token to a blacklist
      // For now, we just clear the user from the request
      req.user = undefined;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Logged out successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleAuthError(error, res);
    }
  };

  /**
   * Get current user info
   */
  getCurrentUser = async (req: ExtendedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('User not authenticated');
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          permissions: req.user.permissions
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleAuthError(error, res);
    }
  };

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AuthConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<AuthConfig, 'jwtSecret'> {
    const { jwtSecret, ...safeConfig } = this.config;
    return safeConfig;
  }
}

// Create default instance
const authMiddleware = new AuthMiddleware();

// Export individual middleware functions
export const authenticate = authMiddleware.authenticate;
export const authorize = authMiddleware.authorize;
export const requireRole = authMiddleware.requireRole;
export const optionalAuth = authMiddleware.optionalAuth;
export const apiKeyAuth = authMiddleware.apiKeyAuth;
export const refreshToken = authMiddleware.refreshToken;
export const logout = authMiddleware.logout;
export const getCurrentUser = authMiddleware.getCurrentUser;

// Export class and default instance
export default authMiddleware;