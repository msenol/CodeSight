 
 
 
 
 
 
 
 
 
 
import type { Response, NextFunction } from 'express';
import { type ExtendedRequest, type ErrorResponse, type ValidationErrorDetail, HTTP_STATUS, ValidationError, AuthenticationError, AuthorizationError, RateLimitError } from './types.js';
import { ZodError } from 'zod';

// Rule 15: Global declarations for Node.js environment
declare const process: {
  env: Record<string, string | undefined>;
};
declare const console: Console;

export interface ErrorHandlerConfig {
  includeStack?: boolean;
  logErrors?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  customErrorMap?: Map<string, { status: number; message: string }>;
  onError?: (error: unknown, req: ExtendedRequest, res: Response) => void;
}

const defaultConfig: ErrorHandlerConfig = {
  includeStack: process.env.NODE_ENV === 'development',
  logErrors: true,
  logLevel: 'error',
  customErrorMap: new Map(),
};

export class ErrorHandlerMiddleware {
  private config: ErrorHandlerConfig;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.setupDefaultErrorMap();
  }

  /**
   * Main error handler middleware
   */
  handle = (error: Error, req: ExtendedRequest, res: Response, next: NextFunction): void => {
    try {
      // Log error if configured
      if (this.config.logErrors) {
        this.logError(error, req);
      }

      // Call custom error handler if provided
      if (this.config.onError) {
        this.config.onError(error, req, res);
      }

      // Don't handle if response already sent
      if (res.headersSent) {
        return next(error);
      }

      const errorResponse = this.createErrorResponse(error, req);
      res.status(errorResponse.status).json(errorResponse.body);
    } catch (handlerError) {
      console.error('Error in error handler:', handlerError);

      // Fallback error response
      if (!res.headersSent) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          error: 'Internal server error',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        });
      }
    }
  };

  /**
   * Async error wrapper for route handlers
   */
  static asyncHandler = (fn: (req: ExtendedRequest, res: Response, next: NextFunction) => Promise<void> | void) => {
    return (req: ExtendedRequest, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * Not found handler
   */
    notFound = (req: ExtendedRequest, res: Response): void => {
    const error = new Error(`Route not found: ${req.method} ${req.path}`);
    error.name = 'NotFoundError';

    res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      error: 'Not found',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  };

  /**
   * Method not allowed handler
   */
  methodNotAllowed = (allowedMethods: string[]) => {
    return (req: ExtendedRequest, res: Response): void => {
      res.setHeader('Allow', allowedMethods.join(', '));

      res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
        success: false,
        error: 'Method not allowed',
        message: `Method ${req.method} not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      });
    };
  };

  /**
   * Validation error handler
   */
  validationError = (
    error: ZodError,
    req: ExtendedRequest,
    res: Response,
  ): void => {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Validation failed',
      message: 'Request validation failed',
      details: validationErrors,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  };

  /**
   * Database error handler
   */
  databaseError = (error: Error, req: ExtendedRequest, res: Response): void => {
    console.error('Database error:', error);

    // Don't expose database details in production
    const message =
      process.env.NODE_ENV === 'development' ? error.message : 'Database operation failed';

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: 'Database error',
      message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  };

  /**
   * Create error response based on error type
   */
  private createErrorResponse(
    error: Error,
    req: ExtendedRequest,
  ): {
    status: number;
    body: ErrorResponse;
  } {
    let status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let errorType = 'Internal server error';
    let details: Record<string, unknown> | Array<Record<string, unknown>> | undefined = undefined;

    // Handle specific error types
    if (error instanceof ValidationError) {
      status = HTTP_STATUS.BAD_REQUEST;
      errorType = 'Validation error';
      ({ message } = error);
      const validationDetails = error.details;
      // Convert ValidationErrorDetail[] to match expected type
      details = (validationDetails || []).map(detail => ({ field: detail.field, message: detail.message, value: detail.value, code: detail.code }));
    } else if (error instanceof ZodError) {
      status = HTTP_STATUS.BAD_REQUEST;
      errorType = 'Validation error';
      message = 'Request validation failed';
      details = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));
    } else if (error instanceof AuthenticationError) {
      status = HTTP_STATUS.UNAUTHORIZED;
      errorType = 'Authentication error';
      ({ message } = error);
    } else if (error instanceof AuthorizationError) {
      status = HTTP_STATUS.FORBIDDEN;
      errorType = 'Authorization error';
      ({ message } = error);
    } else if (error instanceof RateLimitError) {
      status = HTTP_STATUS.TOO_MANY_REQUESTS;
      errorType = 'Rate limit error';
      ({ message } = error);
      details = { retryAfter: error.retryAfter };
    } else if (error.name === 'NotFoundError') {
      status = HTTP_STATUS.NOT_FOUND;
      errorType = 'Not found';
      ({ message } = error);
    } else if (error.name === 'CastError' || error.name === 'ValidationError') {
      status = HTTP_STATUS.BAD_REQUEST;
      errorType = 'Invalid data';
      message = 'Invalid data provided';
    } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
      status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      errorType = 'Database error';
      message =
        process.env.NODE_ENV === 'development' ? error.message : 'Database operation failed';
    } else if (error.name === 'SyntaxError') {
      status = HTTP_STATUS.BAD_REQUEST;
      errorType = 'Syntax error';
      message = 'Invalid JSON in request body';
    } else if (error.name === 'TimeoutError') {
      status = HTTP_STATUS.GATEWAY_TIMEOUT;
      errorType = 'Timeout error';
      message = 'Request timeout';
    } else {
      // Check custom error map
      const customError = this.config.customErrorMap?.get(error.name);
      if (customError) {
        ({ status, message } = customError);
        errorType = error.name;
      } else {
        // Generic error handling
        message =
          process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred';
      }
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: errorType,
      message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    };

    if (details) {
      // Handle the type union properly
      if (Array.isArray(details)) {
        // If it's an array, take the first element and cast to ValidationErrorDetail
        errorResponse.details = details[0] as unknown as ValidationErrorDetail;
      } else {
        // If it's a single object, cast it properly
        errorResponse.details = details as unknown as ValidationErrorDetail;
      }
    }

    if (this.config.includeStack && error.stack) {
      errorResponse.stack = error.stack;
    }

    return { status, body: errorResponse };
  }

  /**
   * Log error with context
   */
  private logError(error: Error, req: ExtendedRequest): void {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      request: {
        id: req.requestId,
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        headers: this.sanitizeHeaders(req.headers),
        userAgent: req.get('User-Agent'),
        ip: req.clientIp ?? req.ip,
        user: req.user
          ? {
              id: req.user.id,
              email: req.user.email,
              role: req.user.role,
            }
          : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    // Log based on configured level
    switch (this.config.logLevel) {
      case 'error':
        console.error('Application error:', logData);
        break;
      case 'warn':
        console.warn('Application warning:', logData);
        break;
      case 'info':
        console.info('Application info:', logData);
        break;
      case 'debug':
        console.debug('Application debug:', logData);
        break;
      default:
        // Default to error level if undefined
        console.error('Application error:', logData);
        break;
    }
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: Record<string, string | string[]>): Record<string, string | string[]> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Setup default error mappings
   */
  private setupDefaultErrorMap(): void {
    if (!this.config.customErrorMap) {
      this.config.customErrorMap = new Map();
    }

    // Add common error mappings
    this.config.customErrorMap.set('ENOTFOUND', {
      status: HTTP_STATUS.SERVICE_UNAVAILABLE,
      message: 'External service unavailable',
    });

    this.config.customErrorMap.set('ECONNREFUSED', {
      status: HTTP_STATUS.SERVICE_UNAVAILABLE,
      message: 'Connection refused',
    });

    this.config.customErrorMap.set('ETIMEDOUT', {
      status: HTTP_STATUS.GATEWAY_TIMEOUT,
      message: 'Request timeout',
    });

    this.config.customErrorMap.set('PayloadTooLargeError', {
      status: HTTP_STATUS.BAD_REQUEST,
      message: 'Request payload too large',
    });
  }

  /**
   * Add custom error mapping
   */
  addErrorMapping(errorName: string, status: number, message: string): void {
    if (!this.config.customErrorMap) {
      this.config.customErrorMap = new Map();
    }
    this.config.customErrorMap.set(errorName, { status, message });
  }

  /**
   * Remove error mapping
   */
  removeErrorMapping(errorName: string): void {
    this.config.customErrorMap?.delete(errorName);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }

  /**
   * Create custom error classes
   */
  static createCustomError(name: string, defaultMessage: string, defaultStatus: number) {
    return class extends Error {
      public status: number;

      constructor(message = defaultMessage, status = defaultStatus) {
        super(message);
        this.name = name;
        this.status = status;
        Error.captureStackTrace(this, this.constructor);
      }
    };
  }

  /**
   * Error factory for common errors
   */
  static errors = {
    BadRequest: (message = 'Bad request') => {
      const error = new Error(message);
      error.name = 'BadRequestError';
      return error;
    },

    Unauthorized: (message = 'Unauthorized') => {
      const error = new Error(message);
      error.name = 'UnauthorizedError';
      return error;
    },

    Forbidden: (message = 'Forbidden') => {
      const error = new Error(message);
      error.name = 'ForbiddenError';
      return error;
    },

    NotFound: (message = 'Not found') => {
      const error = new Error(message);
      error.name = 'NotFoundError';
      return error;
    },

    Conflict: (message = 'Conflict') => {
      const error = new Error(message);
      error.name = 'ConflictError';
      return error;
    },

    UnprocessableEntity: (message = 'Unprocessable entity') => {
      const error = new Error(message);
      error.name = 'UnprocessableEntityError';
      return error;
    },

    InternalServerError: (message = 'Internal server error') => {
      const error = new Error(message);
      error.name = 'InternalServerError';
      return error;
    },

    ServiceUnavailable: (message = 'Service unavailable') => {
      const error = new Error(message);
      error.name = 'ServiceUnavailableError';
      return error;
    },
  };
}

// Create default instance
const errorHandlerMiddleware = new ErrorHandlerMiddleware();

// Export convenience functions
export const errorHandler = errorHandlerMiddleware.handle;
export const notFoundHandler = errorHandlerMiddleware.notFound;
export const { asyncHandler } = ErrorHandlerMiddleware;
export const { createCustomError } = ErrorHandlerMiddleware;
export const { errors } = ErrorHandlerMiddleware;

// Export class and default instance
export default errorHandlerMiddleware;
