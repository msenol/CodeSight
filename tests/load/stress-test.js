// K6 stress test for CodeSight MCP Server
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import http from 'k6/http';

// Custom metrics for stress testing
const stressErrors = new Rate('stress_errors');
const memoryUsage = new Rate('memory_usage');
const cpuUsage = new Rate('cpu_usage');

// Stress test configuration - high load for extended periods
export const options = {
  stages: [
    { duration: '1m', target: 100 },    // Ramp up to 100 users
    { duration: '3m', target: 300 },    // Ramp up to 300 users
    { duration: '5m', target: 500 },    // Peak load - 500 concurrent users
    { duration: '3m', target: 300 },    // Scale down
    { duration: '1m', target: 100 },    // Further scale down
    { duration: '2m', target: 50 },     // Sustained medium load
    { duration: '1m', target: 0 },      // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Allow higher response times under stress
    http_req_failed: ['rate<0.2'],     // Allow 20% error rate under stress
    stress_errors: ['rate<0.2'],
  },
  discardResponseBodies: true, // Improve performance by discarding bodies
  noConnectionReuse: false,     // Enable connection reuse
  userAgent: 'k6-stress-test/1.0',
};

// Complex queries for stress testing
const STRESS_QUERIES = [
  'complex async function error handling with proper logging',
  'database connection pooling and transaction management',
  'authentication middleware with JWT token validation',
  'RESTful API endpoint with comprehensive error handling',
  'unit testing framework setup with mocking strategies',
  'dependency injection container configuration',
  'memory management and garbage collection optimization',
  'parallel processing with thread-safe data structures',
  'caching strategies with Redis and invalidation policies',
  'monitoring and observability with metrics collection',
];

export function setup() {
  console.log('Starting stress test for CodeSight MCP Server');
  console.log('This test simulates high-load production scenarios');

  // Pre-warm the server
  for (let i = 0; i < 10; i++) {
    http.get('http://localhost:4000/health', { timeout: '5s' });
  }

  return {
    baseUrl: 'http://localhost:4000',
    startTime: Date.now(),
  };
}

export default function(data) {
  // Random test scenario selection
  const scenario = Math.random();

  if (scenario < 0.7) {
    // 70%: Search operations (most common)
    performSearch(data);
  } else if (scenario < 0.85) {
    // 15%: Codebase management
    performCodebaseOperation(data);
  } else if (scenario < 0.95) {
    // 10%: Health checks
    performHealthCheck(data);
  } else {
    // 5%: Metrics endpoint
    performMetricsCheck(data);
  }

  // Variable think time to simulate realistic usage patterns
  sleep(Math.random() * 3 + 0.1); // 0.1-3.1s
}

function performSearch(data) {
  const query = STRESS_QUERIES[Math.floor(Math.random() * STRESS_QUERIES.length)];
  const payload = JSON.stringify({
    query,
    codebase_id: generateRandomCodebaseId(),
    limit: Math.floor(Math.random() * 50) + 5, // 5-54 results
    filters: {
      file_types: getRandomFileTypes(),
      entity_types: getRandomEntityTypes(),
    },
    include_content: Math.random() > 0.5,
  });

  const response = http.post(`${data.baseUrl}/api/queries`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '15s', // Longer timeout under stress
  });

  const success = check(response, {
    'search query succeeded': (r) => r.status === 200 || r.status === 429, // Accept rate limiting
    'search response time reasonable': (r) => r.timings.duration < 5000, // 5s max under stress
  });

  stressErrors.add(!success);
}

function performCodebaseOperation(data) {
  const operations = ['GET', 'POST'];
  const operation = operations[Math.floor(Math.random() * operations.length)];

  let response;
  if (operation === 'GET') {
    response = http.get(`${data.baseUrl}/api/codebases`, {
      timeout: '10s',
    });
  } else {
    const payload = JSON.stringify({
      name: `stress-test-codebase-${Date.now()}`,
      path: '/tmp/stress-test',
      language: getRandomLanguage(),
      description: 'Stress test codebase',
    });

    response = http.post(`${data.baseUrl}/api/codebases`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: '15s',
    });
  }

  const success = check(response, {
    'codebase operation succeeded': (r) => r.status < 500,
    'codebase operation response time reasonable': (r) => r.timings.duration < 3000,
  });

  stressErrors.add(!success);
}

function performHealthCheck(data) {
  const healthEndpoints = ['/health', '/health/detailed', '/health/ready'];
  const endpoint = healthEndpoints[Math.floor(Math.random() * healthEndpoints.length)];

  const response = http.get(`${data.baseUrl}${endpoint}`, {
    timeout: '5s',
  });

  const success = check(response, {
    'health check succeeded': (r) => r.status === 200,
    'health check response fast': (r) => r.timings.duration < 1000,
  });

  stressErrors.add(!success);
}

function performMetricsCheck(data) {
  const response = http.get(`${data.baseUrl}/metrics`, {
    timeout: '3s',
  });

  const success = check(response, {
    'metrics endpoint accessible': (r) => r.status === 200,
    'metrics response quick': (r) => r.timings.duration < 500,
  });

  stressErrors.add(!success);
}

// Helper functions for generating test data
function generateRandomCodebaseId() {
  const ids = ['codebase-1', 'codebase-2', 'codebase-3', 'codebase-large', 'codebase-test'];
  return ids[Math.floor(Math.random() * ids.length)];
}

function getRandomFileTypes() {
  const allTypes = ['ts', 'js', 'rs', 'py', 'go', 'java', 'cpp', 'cs'];
  const count = Math.floor(Math.random() * 3) + 1; // 1-3 file types
  const selected = [];

  for (let i = 0; i < count; i++) {
    const type = allTypes[Math.floor(Math.random() * allTypes.length)];
    if (!selected.includes(type)) {
      selected.push(type);
    }
  }

  return selected;
}

function getRandomEntityTypes() {
  const allTypes = ['function', 'class', 'method', 'variable', 'interface', 'enum'];
  const count = Math.floor(Math.random() * 2) + 1; // 1-2 entity types
  const selected = [];

  for (let i = 0; i < count; i++) {
    const type = allTypes[Math.floor(Math.random() * allTypes.length)];
    if (!selected.includes(type)) {
      selected.push(type);
    }
  }

  return selected;
}

function getRandomLanguage() {
  const languages = ['typescript', 'javascript', 'rust', 'python', 'go', 'java'];
  return languages[Math.floor(Math.random() * languages.length)];
}

export function teardown(data) {
  const duration = Date.now() - data.startTime;
  console.log(`Stress test completed in ${Math.round(duration / 1000)}s`);
  console.log(`Final error rate: ${(stressErrors.rate * 100).toFixed(2)}%`);

  // Log final statistics
  console.log('=== Stress Test Summary ===');
  console.log(`Total requests: See k6 summary for details`);
  console.log(`Error rate: ${(stressErrors.rate * 100).toFixed(2)}%`);
  console.log(`Test duration: ${Math.round(duration / 1000)}s`);
}