import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createFastifyServer } from '../src/server.js';

/**
 * Basic Integration Tests for CodeSight MCP Server
 *
 * These tests verify that the server starts correctly and
 * basic health check endpoints are working.
 */

describe('CodeSight MCP Server - Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createFastifyServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check Endpoints', () => {
    it('should respond to simple health check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });

    it('should respond to detailed health check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toMatch(/healthy|degraded|unhealthy/);
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeDefined();
      expect(body.components).toBeDefined();
    });

    it('should respond to readiness check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect([200, 503]).toContain(response.statusCode);
      const body = JSON.parse(response.body);
      expect(body.ready).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });

    it('should respond to liveness check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.alive).toBe(true);
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeDefined();
    });

    it('should provide metrics endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.headers['content-type']).toContain('text/plain');
        expect(response.body).toContain('# HELP');
      }
    });
  });

  describe('API Health Endpoint', () => {
    it('should respond to API health check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('Code Intelligence MCP Server');
      expect(body.version).toBeDefined();
    });
  });

  describe('Server Configuration', () => {
    it('should have proper server configuration', () => {
      expect(app).toBeDefined();
      expect(app.hasRoute({ method: 'GET', url: '/health' })).toBe(true);
      expect(app.hasRoute({ method: 'GET', url: '/health/detailed' })).toBe(true);
      expect(app.hasRoute({ method: 'GET', url: '/health/ready' })).toBe(true);
      expect(app.hasRoute({ method: 'GET', url: '/health/live' })).toBe(true);
      expect(app.hasRoute({ method: 'GET', url: '/metrics' })).toBe(true);
      expect(app.hasRoute({ method: 'GET', url: '/api/health' })).toBe(true);
    });
  });
});
