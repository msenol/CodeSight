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
      // Fastify's reply.send is automatically called when handlers return values
      // In unit tests, we don't need to test send() since handlers use return
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

      // Verify reply.code was called to set HTTP status
      expect(mockReply.code).toHaveBeenCalledWith(200);
      // Verify result is returned (Fastify handles sending automatically)
      expect(result).toBeDefined();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('simpleHealthCheckHandler', () => {
    it('should return simple health status', async () => {
      const result = await simpleHealthCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      // Verify reply.code was called to set HTTP status
      expect(mockReply.code).toHaveBeenCalledWith(200);
      // Verify result is returned (Fastify handles sending automatically)
      expect(result).toBeDefined();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('readinessCheckHandler', () => {
    it('should return readiness status', async () => {
      const result = await readinessCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      // Verify reply.code was called to set HTTP status
      expect(mockReply.code).toHaveBeenCalledWith(200);
      // Verify result is returned with correct structure
      expect(result).toBeDefined();
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

      // Verify reply.code was called to set HTTP status
      expect(mockReply.code).toHaveBeenCalledWith(200);
      // Verify result is returned with correct structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('alive');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(typeof result.alive).toBe('boolean');
      expect(typeof result.uptime).toBe('number');
    });
  });
});