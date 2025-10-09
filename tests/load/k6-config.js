// K6 configuration for CodeSight MCP Server load testing
import { check } from 'k6';
import { Rate } from 'k6/metrics';
import http from 'k6/http';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration options
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Warm up
    { duration: '1m', target: 50 },    // Load test
    { duration: '2m', target: 100 },   // Sustained load
    { duration: '1m', target: 200 },   // Peak load
    { duration: '1m', target: 100 },   // Scale down
    { duration: '30s', target: 10 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete within 500ms
    http_req_failed: ['rate<0.1'],    // Error rate must be below 10%
    errors: ['rate<0.1'],              // Custom error rate below 10%
  },
};

// Base URL for the MCP server
const BASE_URL = 'http://localhost:4000';

// Test data
const QUERIES = [
  'function authentication',
  'database connection',
  'error handling',
  'user interface',
  'api endpoint',
  'configuration file',
  'unit test',
  'async function',
  'class definition',
  'module import',
];

export function setup() {
  // Initialize test data
  console.log('Starting load tests for CodeSight MCP Server');
  console.log(`Target server: ${BASE_URL}`);

  // Verify server is accessible
  const healthResponse = http.get(`${BASE_URL}/health`, {
    timeout: '10s',
  });

  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
  });

  return {
    serverUrl: BASE_URL,
  };
}

export default function(data) {
  // Test search endpoint
  const searchPayload = JSON.stringify({
    query: QUERIES[Math.floor(Math.random() * QUERIES.length)],
    codebase_id: "test-codebase-id",
    limit: 10,
    filters: {
      file_types: ["ts", "js", "rs"],
      entity_types: ["function", "class"]
    }
  });

  const searchParams = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '5s',
  };

  const searchResponse = http.post(
    `${data.serverUrl}/api/queries`,
    searchPayload,
    searchParams
  );

  const searchSuccess = check(searchResponse, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 500ms': (r) => r.timings.duration < 500,
    'search response is valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });

  // Track custom error metric
  errorRate.add(!searchSuccess);

  // Test codebase management endpoints
  if (Math.random() < 0.1) { // 10% of the time
    const codebasesResponse = http.get(`${data.serverUrl}/api/codebases`, {
      timeout: '3s',
    });

    check(codebasesResponse, {
      'codebases status is 200': (r) => r.status === 200,
      'codebases response time < 300ms': (r) => r.timings.duration < 300,
    });

    errorRate.add(codebasesResponse.status !== 200);
  }

  // Test health endpoint
  if (Math.random() < 0.05) { // 5% of the time
    const healthResponse = http.get(`${data.serverUrl}/health`, {
      timeout: '2s',
    });

    check(healthResponse, {
      'health status is 200': (r) => r.status === 200,
      'health response time < 100ms': (r) => r.timings.duration < 100,
    });

    errorRate.add(healthResponse.status !== 200);
  }
}

export function teardown(data) {
  console.log('Load testing completed');
  console.log(`Final error rate: ${errorRate.rate * 100}%`);
}