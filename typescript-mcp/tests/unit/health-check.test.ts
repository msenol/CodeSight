import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  healthCheckHandler,
  simpleHealthCheckHandler,
  readinessCheckHandler,
  livenessCheckHandler,
} from '../../src/health-check';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Unit Tests for Health Check Module
 *
 * These tests verify the health check logic without requiring
 * a full server setup or database connections.
 */

describe('Health Check Handlers', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockRequest = {
      query: {},
    };
    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe('healthCheckHandler', () => {
    it('should return health status', async () => {
      const result = await healthCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    });
  });

  describe('simpleHealthCheckHandler', () => {
    it('should return simple health status', async () => {
      const result = await simpleHealthCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(result).toHaveProperty('status', 'healthy');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('readinessCheckHandler', () => {
    it('should return readiness status', async () => {
      const result = await readinessCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(result).toHaveProperty('ready');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('checks');
      expect(typeof result.ready).toBe('boolean');
    });
  });

  describe('livenessCheckHandler', () => {
    it('should return liveness status', async () => {
      const result = await livenessCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(result).toHaveProperty('alive', true);
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(typeof result.uptime).toBe('number');
    });
  });
});