import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  healthCheckHandler,
  simpleHealthCheckHandler,
  readinessCheckHandler,
  livenessCheckHandler,
} from '../src/health-check';
import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Unit Tests for Health Check Module
 *
 * These tests verify the health check logic without requiring
 * a full server setup or database connections.
 */

// Mock dependencies
vi.mock('../src/services/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../src/services/IndexingService.js', () => ({
  IndexingService: {
    testConnection: vi.fn(),
    getHealthStats: vi.fn(),
    getMetrics: vi.fn(),
  },
}));

vi.mock('../src/services/SearchEngine.js', () => ({
  SearchEngine: {
    healthCheck: vi.fn(),
  },
}));

vi.mock('../src/rust-bridge.js', () => ({
  rustBridge: {
    isAvailable: vi.fn(),
    getVersion: vi.fn(),
  },
}));

vi.mock('../src/config.js', () => ({
  config: {
    version: '0.1.0',
  },
}));

describe('Health Check - Unit Tests', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock request and reply
    mockRequest = {};
    mockReply = {
      code: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('Simple Health Check', () => {
    it('should return basic health status', async () => {
      const result = await simpleHealthCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      mockReply.code = vi.fn().mockReturnValue({
        status: 'error',
        timestamp: new Date().toISOString(),
      });

      const result = await simpleHealthCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(result.status).toBe('error');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('Readiness Check', () => {
    it('should return ready when all checks pass', async () => {
      // Mock successful dependencies
      const { IndexingService } = await import('../src/services/IndexingService');
      const { SearchEngine } = await import('../src/services/SearchEngine');
      const { rustBridge } = await import('../src/rust-bridge');

      vi.mocked(IndexingService.testConnection).mockResolvedValue(undefined);
      vi.mocked(IndexingService.getHealthStats).mockResolvedValue({ files: 10, entities: 50 });
      vi.mocked(SearchEngine.healthCheck).mockResolvedValue(undefined);
      vi.mocked(rustBridge.isAvailable).mockResolvedValue(true);

      const result = await readinessCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(result.ready).toBe(true);
      expect(result.checks.database).toBe(true);
      expect(result.checks.indexing).toBe(true);
      expect(result.checks.search).toBe(true);
      expect(result.checks.rustBridge).toBe(true);
    });

    it('should return not ready when database fails', async () => {
      const { IndexingService } = await import('../src/services/IndexingService');
      const { SearchEngine } = await import('../src/services/SearchEngine');
      const { rustBridge } = await import('../src/rust-bridge');

      vi.mocked(IndexingService.testConnection).mockRejectedValue(new Error('Connection failed'));
      vi.mocked(IndexingService.getHealthStats).mockResolvedValue({ files: 10, entities: 50 });
      vi.mocked(SearchEngine.healthCheck).mockResolvedValue(undefined);
      vi.mocked(rustBridge.isAvailable).mockResolvedValue(true);

      const result = await readinessCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(result.ready).toBe(false);
      expect(result.checks.database).toBe(false);
    });
  });

  describe('Liveness Check', () => {
    it('should always return alive for liveness', async () => {
      const result = await livenessCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(result.alive).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
    });
  });

  describe('Detailed Health Check', () => {
    it('should return comprehensive health status', async () => {
      // Mock all dependencies
      const { IndexingService } = await import('../src/services/IndexingService');
      const { SearchEngine } = await import('../src/services/SearchEngine');
      const { rustBridge } = await import('../src/rust-bridge');

      vi.mocked(IndexingService.testConnection).mockResolvedValue(undefined);
      vi.mocked(IndexingService.getHealthStats).mockResolvedValue({
        files: 47,
        entities: 377,
        lastIndexed: new Date().toISOString(),
      });
      vi.mocked(IndexingService.getMetrics).mockResolvedValue({
        searchQueries: 100,
        averageSearchTime: 25,
        errorRate: 0.02,
        activeConnections: 5,
      });
      vi.mocked(SearchEngine.healthCheck).mockResolvedValue(undefined);
      vi.mocked(rustBridge.isAvailable).mockResolvedValue(true);
      vi.mocked(rustBridge.getVersion).mockResolvedValue('1.0.0');

      const result = await healthCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(result.status).toBe('healthy');
      expect(result.version).toBe('0.1.0');
      expect(result.uptime).toBeGreaterThan(0);

      // Check components
      expect(result.components.database.status).toBe('healthy');
      expect(result.components.rustBridge.status).toBe('healthy');
      expect(result.components.indexing.status).toBe('healthy');
      expect(result.components.search.status).toBe('healthy');
      expect(result.components.memory.status).toBe('healthy');

      // Check metrics
      expect(result.metrics.totalSearchQueries).toBe(100);
      expect(result.metrics.averageSearchTime).toBe(25);
    });

    it('should handle degraded state when some components fail', async () => {
      const { IndexingService } = await import('../src/services/IndexingService');
      const { SearchEngine } = await import('../src/services/SearchEngine');
      const { rustBridge } = await import('../src/rust-bridge');

      vi.mocked(IndexingService.testConnection).mockRejectedValue(new Error('Database error'));
      vi.mocked(IndexingService.getHealthStats).mockResolvedValue({ files: 0, entities: 0 });
      vi.mocked(SearchEngine.healthCheck).mockResolvedValue(undefined);
      vi.mocked(rustBridge.isAvailable).mockResolvedValue(false);

      const result = await healthCheckHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(result.status).toBe('degraded');
      expect(result.components.database.status).toBe('unhealthy');
      expect(result.components.rustBridge.status).toBe('degraded');
      expect(result.components.indexing.status).toBe('degraded');
    });

    it('should handle critical errors in health check', async () => {
      const { IndexingService } = await import('../src/services/IndexingService');

      vi.mocked(IndexingService.testConnection).mockImplementation(() => {
        throw new Error('Critical failure');
      });

      await healthCheckHandler(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          error: 'Health check failed',
        }),
      );
    });
  });
});
