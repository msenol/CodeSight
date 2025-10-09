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
      code: vi.fn(),
      send: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
  });

  describe('healthCheckHandler', () => {
    it('should return health status', async () => {
      await healthCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalled();
    });
  });

  describe('simpleHealthCheckHandler', () => {
    it('should return simple health status', async () => {
      await simpleHealthCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalled();
    });
  });

  describe('readinessCheckHandler', () => {
    it('should return readiness status', async () => {
      await readinessCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalled();
    });
  });

  describe('livenessCheckHandler', () => {
    it('should return liveness status', async () => {
      await livenessCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalled();
    });
  });
});