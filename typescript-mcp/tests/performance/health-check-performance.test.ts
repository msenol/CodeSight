/* eslint-disable @typescript-eslint/no-unused-vars */
 
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createFastifyServer } from '../../src/server';

// Extend Response interface for testing
declare global {
  interface Response {
    url?: string;
  }
}

/**
 * Performance Tests for Health Check Endpoints
 *
 * These tests verify that health check endpoints meet performance
 * requirements and can handle concurrent requests efficiently.
 */

describe('Health Check - Performance Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createFastifyServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Response Time Performance', () => {
    it('should respond to simple health check in under 100ms', async () => {
      const startTime = performance.now();

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(100);
    });

    it('should respond to liveness check in under 50ms', async () => {
      const startTime = performance.now();

      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(50);
    });

    it('should respond to API health check in under 50ms', async () => {
      const startTime = performance.now();

      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.statusCode).toBe(200);
      expect(responseTime).toBeLessThan(50);
    });

    it('should respond to readiness check in under 200ms', async () => {
      const startTime = performance.now();

      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect([200, 503]).toContain(response.statusCode);
      expect(responseTime).toBeLessThan(200);
    });

    it('should respond to detailed health check in under 500ms', async () => {
      const startTime = performance.now();

      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect([200, 503]).toContain(response.statusCode);
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle 10 concurrent health check requests', async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'GET',
            url: '/health',
          }),
        );

      const startTime = performance.now();
      const responses = await Promise.all(requests);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Total time should be reasonable (much less than 10 * single request time)
      expect(totalTime).toBeLessThan(500);

      // Average time per request should be reasonable
      const averageTime = totalTime / concurrentRequests;
      expect(averageTime).toBeLessThan(100);
    });

    it('should handle 50 concurrent simple requests', async () => {
      const concurrentRequests = 50;
      const requests = Array(concurrentRequests)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'GET',
            url: '/health/live',
          }),
        );

      const startTime = performance.now();
      const responses = await Promise.all(requests);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Total time should be reasonable
      expect(totalTime).toBeLessThan(200);

      // Average time per request
      const averageTime = totalTime / concurrentRequests;
      expect(averageTime).toBeLessThan(20);
    });

    it('should handle mixed concurrent requests', async () => {
      const requestTypes = [
        { url: '/health', expectedStatus: 200 },
        { url: '/health/live', expectedStatus: 200 },
        { url: '/api/health', expectedStatus: 200 },
        { url: '/health/ready', expectedStatus: [200, 503] },
        { url: '/health/detailed', expectedStatus: [200, 503] },
      ];

      const requests = requestTypes.flatMap(({ url, expectedStatus }) =>
        Array(10)
          .fill(null)
          .map(() => app.inject({ method: 'GET', url })),
      );

      const startTime = performance.now();
      const responses = await Promise.all(requests);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All requests should meet their expected status
      responses.forEach((response, index) => {
        const expectedStatus = requestTypes[Math.floor(index / 10)].expectedStatus;
        if (Array.isArray(expectedStatus)) {
          expect(expectedStatus).toContain(response.statusCode);
        } else {
          expect(response.statusCode).toBe(expectedStatus);
        }
      });

      // Total time should be reasonable for 50 requests
      expect(totalTime).toBeLessThan(1000);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory on repeated health checks', async () => {
      const iterations = 100;
      const initialMemory = process.memoryUsage().heapUsed;

      // Run many health check requests
      for (let i = 0; i < iterations; i++) {
        await app.inject({
          method: 'GET',
          url: '/health',
        });

        // Check memory every 10 iterations
        if (i % 10 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryIncrease = currentMemory - initialMemory;

          // Memory increase should be reasonable (less than 1MB per 10 requests)
          expect(memoryIncrease).toBeLessThan(1024 * 1024);
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const totalMemoryIncrease = finalMemory - initialMemory;

      // Total memory increase should be reasonable for 100 requests
      expect(totalMemoryIncrease).toBeLessThan(5 * 1024 * 1024); // 5MB
    });

    it('should maintain stable memory usage under load', async () => {
      const samples = [];
      const sampleCount = 20;
      const requestsPerSample = 25;

      for (let i = 0; i < sampleCount; i++) {
        // Run burst of requests
        const requests = Array(requestsPerSample)
          .fill(null)
          .map(() =>
            app.inject({
              method: 'GET',
              url: '/health',
            }),
          );
        await Promise.all(requests);

        // Record memory usage
        const memoryUsage = process.memoryUsage();
        samples.push({
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
        });

        // Small delay between samples
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Memory usage should be relatively stable
      const heapUsedValues = samples.map(s => s.heapUsed);
      const minHeap = Math.min(...heapUsedValues);
      const maxHeap = Math.max(...heapUsedValues);
      const heapVariation = maxHeap - minHeap;

      // Heap usage should not vary by more than 2MB
      expect(heapVariation).toBeLessThan(2 * 1024 * 1024);
    });
  });

  describe('Resource Usage', () => {
    it('should have reasonable response sizes', async () => {
      const responses = await Promise.all([
        app.inject({ method: 'GET', url: '/health' }),
        app.inject({ method: 'GET', url: '/health/live' }),
        app.inject({ method: 'GET', url: '/api/health' }),
        app.inject({ method: 'GET', url: '/health/ready' }),
        app.inject({ method: 'GET', url: '/health/detailed' }),
        app.inject({ method: 'GET', url: '/metrics' }),
      ]);

      // Check response sizes are reasonable
      responses.forEach(response => {
        const size = Buffer.byteLength(response.body, 'utf8');

        // Simple endpoints should be small
        if (
          response.url === '/health' ||
          response.url === '/health/live' ||
          response.url === '/api/health'
        ) {
          expect(size).toBeLessThan(200); // Less than 200 bytes
        }

        // Complex endpoints can be larger but still reasonable
        else if (response.url === '/health/detailed') {
          expect(size).toBeLessThan(5000); // Less than 5KB
        }

        // Metrics can be larger
        else if (response.url === '/metrics') {
          expect(size).toBeLessThan(10000); // Less than 10KB
        }
      });
    });
  });
});
