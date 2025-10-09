// K6 Configuration for CodeSight MCP Server Load Testing
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');

// Test configuration
export let options = {
  stages: [
    // Warmup phase
    { duration: '30s', target: 5 },
    // Normal load
    { duration: '2m', target: 20 },
    // Peak load
    { duration: '1m', target: 50 },
    // Sustained peak
    { duration: '3m', target: 100 },
    // Scale down
    { duration: '1m', target: 20 },
    // Recovery
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'], // Error rate under 10%
    errors: ['rate<0.1'],
  },
  insecureSkipTLSVerify: true,
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// Test data
const TEST_QUERIES = [
  'user authentication functions',
  'database service methods',
  'API endpoint handlers',
  'validation utilities',
  'error handling patterns',
  'middleware implementations',
  'caching mechanisms',
  'logging utilities',
  'configuration management',
  'security checks',
];

const MCP_TOOLS = [
  'search_code',
  'explain_function',
  'find_references',
  'trace_data_flow',
  'analyze_security',
  'get_api_endpoints',
  'check_complexity',
  'find_duplicates',
  'suggest_refactoring',
];

export function setup() {
  // Initialize test data
  console.log('Starting load test against:', BASE_URL);

  // Health check
  let healthResponse = http.get(`${BASE_URL}/health`, {
    timeout: '10s',
  });

  check(healthResponse, {
    'health check passed': (r) => r.status === 200,
  }) || console.error('Health check failed');
}

export default function() {
  // Randomly choose test scenario
  const scenarios = ['api_load', 'mcp_tools_load', 'search_stress'];
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  switch (scenario) {
    case 'api_load':
      testAPIEndpoints();
      break;
    case 'mcp_tools_load':
      testMCPTools();
      break;
    case 'search_stress':
      testSearchStress();
      break;
  }

  sleep(Math.random() * 2 + 1); // 1-3 seconds think time
}

function testAPIEndpoints() {
  // Test various API endpoints
  const endpoints = [
    { method: 'GET', path: '/health' },
    { method: 'GET', path: '/metrics' },
    { method: 'GET', path: '/codebases' },
    { method: 'POST', path: '/codebases', body: JSON.stringify({
      name: `test-codebase-${Math.random()}`,
      path: '/tmp/test',
    }) },
    { method: 'POST', path: '/queries', body: JSON.stringify({
      query: TEST_QUERIES[Math.floor(Math.random() * TEST_QUERIES.length)],
      codebase_id: 'test-codebase',
    }) },
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  let params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '30s',
  };

  let response;
  if (endpoint.body) {
    response = http[endpoint.method.toLowerCase()](`${BASE_URL}${endpoint.path}`, endpoint.body, params);
  } else {
    response = http[endpoint.method.toLowerCase()](`${BASE_URL}${endpoint.path}`, params);
  }

  let success = check(response, {
    [`${endpoint.method} ${endpoint.path} status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${endpoint.method} ${endpoint.path} response time < 500ms`]: (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
}

function testMCPTools() {
  // Test MCP tool endpoints
  const tool = MCP_TOOLS[Math.floor(Math.random() * MCP_TOOLS.length)];
  const query = TEST_QUERIES[Math.floor(Math.random() * TEST_QUERIES.length)];

  let payload = JSON.stringify({
    tool: tool,
    arguments: {
      query: query,
      codebase_id: 'test-codebase',
      max_results: 10,
    },
  });

  let response = http.post(`${BASE_URL}/api/tools/${tool}`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '60s',
  });

  let success = check(response, {
    [`MCP tool ${tool} status is 200`]: (r) => r.status === 200,
    [`MCP tool ${tool} response time < 2s`]: (r) => r.timings.duration < 2000,
    [`MCP tool ${tool} has valid response`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && (body.results || body.data || body.explanation);
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
}

function testSearchStress() {
  // Stress test search functionality
  const query = TEST_QUERIES[Math.floor(Math.random() * TEST_QUERIES.length)];

  // Test both simple and complex queries
  let complexQuery = query;
  if (Math.random() > 0.5) {
    complexQuery = `${query} with parameters and filters`;
  }

  let payload = JSON.stringify({
    query: complexQuery,
    codebase_id: 'test-codebase',
    max_results: Math.floor(Math.random() * 20) + 5,
    include_context: Math.random() > 0.5,
  });

  let response = http.post(`${BASE_URL}/api/search`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '30s',
  });

  let success = check(response, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 1s': (r) => r.timings.duration < 1000,
    'search returns results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.results && Array.isArray(body.results);
      } catch {
        return false;
      }
    },
    'search results have expected structure': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.results.every(result =>
          result.name && result.file_path && result.entity_type
        );
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
}

export function teardown() {
  // Cleanup after test
  console.log('Load test completed');

  // Final health check
  let healthResponse = http.get(`${BASE_URL}/health`);
  if (healthResponse.status === 200) {
    console.log('Server is healthy after load test');
  } else {
    console.error('Server health check failed after load test');
  }
}