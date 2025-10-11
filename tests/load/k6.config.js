/**
 * k6 Load Testing Configuration (T085)
 *
 * Configuration file for k6 load testing of the CodeSight MCP Server.
 * Defines test scenarios, thresholds, and performance targets.
 */

import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for CodeSight MCP
export let errorRate = new Rate('errors');
export let searchResponseTime = new Trend('search_response_time');
export let indexingResponseTime = new Trend('indexing_response_time');
export let apiResponseTime = new Trend('api_response_time');

// Test configuration
export const options = {
  // Stages configuration for gradual load increase
  stages: [
    { duration: '2m', target: 10 },   // Warm up: 10 users for 2 minutes
    { duration: '5m', target: 50 },   // Load test: 50 users for 5 minutes
    { duration: '2m', target: 100 },  // Stress test: 100 users for 2 minutes
    { duration: '5m', target: 100 },  // Sustained load: 100 users for 5 minutes
    { duration: '2m', target: 200 },  // Peak stress: 200 users for 2 minutes
    { duration: '5m', target: 0 },    // Cool down: ramp down to 0 users
  ],

  // Thresholds for performance criteria
  thresholds: {
    // HTTP request success rate should be > 95%
    http_req_failed: ['rate<0.05'],

    // Response time thresholds
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_duration: ['p(99)<1000'], // 99% of requests under 1s

    // Custom metric thresholds
    errors: ['rate<0.05'],             // Error rate < 5%
    search_response_time: ['p(95)<200'], // Search queries under 200ms
    indexing_response_time: ['p(95)<5000'], // Indexing under 5s
    api_response_time: ['p(95)<300'],  // API calls under 300ms

    // System resource thresholds
    http_reqs: ['count>500'],          // Minimum 500 requests total
    http_reqs: ['rate<100'],           // Max 100 requests per second
  },

  // Connection settings
  http_debug: '0',  // Disable HTTP debug for production runs
  batch: 20,         // Maximum number of parallel HTTP requests
  batch_per_host: 10, // Maximum parallel requests per host

  // No cookies or user-agent rotation for simplicity
  discardResponseBodies: true,
  insecureSkipTLSVerify: true, // Only for local testing
};

// Global configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const API_BASE = `${BASE_URL}/api/v1`;
const TEST_TIMEOUT = '30s';

// Test data setup
const TEST_QUERIES = [
  'function authentication',
  'class UserService',
  'interface DatabaseConnection',
  'async processRequest',
  'const API_KEY',
  'export default',
  'import React',
  'type Config',
  'enum UserRole',
  'namespace Utils'
];

const SAMPLE_CODE = `
/**
 * Example authentication service
 */
export class AuthService {
  private token: string | null = null;

  async login(username: string, password: string): Promise<boolean> {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (response.ok) {
      const data = await response.json();
      this.token = data.token;
      return true;
    }

    return false;
  }

  async logout(): Promise<void> {
    if (this.token) {
      await fetch('/api/logout', {
        headers: { 'Authorization': \`Bearer \${this.token}\` }
      });
      this.token = null;
    }
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }
}
`;

// Helper functions
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomCode() {
  const functions = ['login', 'logout', 'authenticate', 'verify', 'validate'];
  const classes = ['AuthService', 'UserService', 'AdminController', 'DataProcessor'];
  const interfaces = ['IAuth', 'IUser', 'IAdmin', 'IData'];

  const type = Math.floor(Math.random() * 3);
  switch (type) {
    case 0: // Function
      return `
export function ${randomChoice(functions)}(params: any): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), Math.random() * 1000);
  });
}`;
    case 1: // Class
      return `
export class ${randomChoice(classes)} {
  private data: Map<string, any> = new Map();

  async process(input: string): Promise<string> {
    return input.toUpperCase();
  }
}`;
    case 2: // Interface
      return `
export interface ${randomChoice(interfaces)} {
  id: string;
  name: string;
  process(): Promise<void>;
}`;
    default:
      return SAMPLE_CODE;
  }
}

// Main test functions
export function setup() {
  console.log('🚀 Starting CodeSight MCP Load Test');
  console.log(`📊 Target URL: ${BASE_URL}`);

  // Create a test codebase for load testing
  const createCodebaseResponse = http.post(`${API_BASE}/codebases`, JSON.stringify({
    name: 'load-test-project',
    path: '/tmp/load-test',
    language: 'typescript'
  }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: TEST_TIMEOUT,
  });

  if (createCodebaseResponse.status !== 201) {
    console.error('❌ Failed to create test codebase');
    return { codebaseId: null };
  }

  const codebaseId = JSON.parse(createCodebaseResponse.body).data.id;
  console.log(`✅ Created test codebase: ${codebaseId}`);

  return { codebaseId };
}

export default function(data) {
  if (!data.codebaseId) {
    console.error('❌ No codebase available, skipping test');
    return;
  }

  // Randomly choose test scenario
  const scenarios = [
    testHealthCheck,
    testSearchQueries,
    testCodeIndexing,
    testAPIEndpoints,
    testConcurrentOperations
  ];

  const selectedScenario = randomChoice(scenarios);
  selectedScenario(data);

  // Random sleep between requests (1-3 seconds)
  sleep(Math.random() * 2 + 1);
}

// Test scenario functions
function testHealthCheck(data) {
  const response = http.get(`${BASE_URL}/health`, {
    timeout: TEST_TIMEOUT,
  });

  const success = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
    'health check contains status': (r) => JSON.parse(r.body).status === 'ok',
  });

  errorRate.add(!success);
  apiResponseTime.add(response.timings.duration);
}

function testSearchQueries(data) {
  const query = randomChoice(TEST_QUERIES);

  const response = http.post(`${API_BASE}/queries`, JSON.stringify({
    codebase_id: data.codebaseId,
    query: query,
    limit: 10,
    include_snippets: true
  }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: TEST_TIMEOUT,
  });

  const success = check(response, {
    'search query status is 200': (r) => r.status === 200,
    'search response time < 200ms': (r) => r.timings.duration < 200,
    'search response has results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && Array.isArray(body.data.results);
      } catch (e) {
        return false;
      }
    },
  });

  errorRate.add(!success);
  searchResponseTime.add(response.timings.duration);
}

function testCodeIndexing(data) {
  // Generate random code to index
  const code = generateRandomCode();

  const response = http.post(`${API_BASE}/codebases/${data.codebaseId}/index`, JSON.stringify({
    files: [{
      path: `test_${Math.random().toString(36).substr(2, 9)}.ts`,
      content: code
    }],
    force_reindex: false
  }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: TEST_TIMEOUT,
  });

  const success = check(response, {
    'indexing request status is 200 or 202': (r) => r.status === 200 || r.status === 202,
    'indexing response time < 5s': (r) => r.timings.duration < 5000,
    'indexing response has job ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data.job_id;
      } catch (e) {
        return false;
      }
    },
  });

  errorRate.add(!success);
  indexingResponseTime.add(response.timings.duration);
}

function testAPIEndpoints(data) {
  const endpoints = [
    { method: 'GET', path: `/codebases/${data.codebaseId}` },
    { method: 'GET', path: `/codebases/${data.codebaseId}/stats` },
    { method: 'GET', path: '/jobs' },
    { method: 'GET', path: '/metrics' }
  ];

  const endpoint = randomChoice(endpoints);

  const response = http.get(`${API_BASE}${endpoint.path}`, {
    timeout: TEST_TIMEOUT,
  });

  const success = check(response, {
    'API endpoint status is 200': (r) => r.status === 200,
    'API response time < 300ms': (r) => r.timings.duration < 300,
    'API response has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data;
      } catch (e) {
        return false;
      }
    },
  });

  errorRate.add(!success);
  apiResponseTime.add(response.timings.duration);
}

function testConcurrentOperations(data) {
  // Simulate concurrent search and indexing
  const searchPromise = () => testSearchQueries(data);
  const apiPromise = () => testAPIEndpoints(data);

  // Execute operations concurrently (simplified simulation)
  searchPromise();
  apiPromise();
}

export function teardown(data) {
  if (data.codebaseId) {
    console.log(`🧹 Cleaning up test codebase: ${data.codebaseId}`);

    const response = http.del(`${API_BASE}/codebases/${data.codebaseId}`, null, {
      timeout: TEST_TIMEOUT,
    });

    if (response.status === 200 || response.status === 204) {
      console.log('✅ Test codebase cleanup completed');
    } else {
      console.error('❌ Failed to cleanup test codebase');
    }
  }

  console.log('🏁 Load test completed');
}

// Error handling
export function handleFailedRequest(requestParams, error, context) {
  console.error(`❌ Request failed: ${error.message}`);
  errorRate.add(1);
}

// Performance monitoring
export function handleSummary(data) {
  console.log('\n📊 Load Test Summary:');
  console.log(`✅ Successful requests: ${data.metrics.http_reqs.count}`);
  console.log(`❌ Failed requests: ${data.metrics.http_req_failed.count}`);
  console.log(`⚡ Average response time: ${data.metrics.http_req_duration.avg.toFixed(2)}ms`);
  console.log(`🎯 95th percentile: ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms`);
  console.log(`🔥 Error rate: ${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%`);

  if (data.metrics.search_response_time) {
    console.log(`🔍 Search avg response: ${data.metrics.search_response_time.avg.toFixed(2)}ms`);
  }

  if (data.metrics.indexing_response_time) {
    console.log(`📁 Indexing avg response: ${data.metrics.indexing_response_time.avg.toFixed(2)}ms`);
  }
}