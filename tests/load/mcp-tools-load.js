// K6 load test specifically for MCP tool endpoints
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import http from 'k6/http';

const errorRate = new Rate('mcp_errors');
const toolResponseTime = new Rate('tool_response_time');

// Test configuration for MCP tools
export const options = {
  stages: [
    { duration: '20s', target: 5 },    // Warm up
    { duration: '2m', target: 20 },    // Concurrent tool usage
    { duration: '3m', target: 50 },    // High concurrent load
    { duration: '1m', target: 25 },    // Scale down
    { duration: '20s', target: 5 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of MCP tool requests within 1s
    http_req_failed: ['rate<0.05'],    // Error rate below 5%
    mcp_errors: ['rate<0.05'],
    tool_response_time: ['p(95)<1000'],
  },
};

// MCP tool test scenarios
const MCP_TOOL_TESTS = [
  {
    name: 'search_code',
    endpoint: '/api/tools/search_code',
    payload: {
      query: 'authentication function',
      codebase_id: 'test-codebase',
      limit: 10,
      file_types: ['ts', 'js']
    }
  },
  {
    name: 'explain_function',
    endpoint: '/api/tools/explain_function',
    payload: {
      function_identifier: 'authenticateUser',
      codebase_id: 'test-codebase',
      detail_level: 'comprehensive'
    }
  },
  {
    name: 'find_references',
    endpoint: '/api/tools/find_references',
    payload: {
      entity_name: 'User',
      entity_type: 'class',
      codebase_id: 'test-codebase'
    }
  },
  {
    name: 'check_complexity',
    endpoint: '/api/tools/check_complexity',
    payload: {
      file_path: 'src/auth/auth.service.ts',
      codebase_id: 'test-codebase'
    }
  },
  {
    name: 'get_api_endpoints',
    endpoint: '/api/tools/get_api_endpoints',
    payload: {
      codebase_id: 'test-codebase',
      include_methods: ['GET', 'POST', 'PUT']
    }
  }
];

export function setup() {
  console.log('Starting MCP tools load test');

  // Verify MCP server is running
  const healthResponse = http.get('http://localhost:4000/health');
  check(healthResponse, {
    'MCP server is healthy': (r) => r.status === 200,
  });

  return {
    baseUrl: 'http://localhost:4000',
  };
}

export default function(data) {
  // Select a random MCP tool to test
  const toolTest = MCP_TOOL_TESTS[Math.floor(Math.random() * MCP_TOOL_TESTS.length)];

  const payload = JSON.stringify(toolTest.payload);

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '10s',
  };

  const startTime = Date.now();
  const response = http.post(
    `${data.baseUrl}${toolTest.endpoint}`,
    payload,
    params
  );
  const responseTime = Date.now() - startTime;

  const success = check(response, {
    [`${toolTest.name} status is 200`]: (r) => r.status === 200,
    [`${toolTest.name} response time < 2s`]: (r) => r.timings.duration < 2000,
    [`${toolTest.name} has valid response`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body !== null && typeof body === 'object';
      } catch {
        return false;
      }
    },
  });

  // Track custom metrics
  errorRate.add(!success);
  toolResponseTime.add(responseTime);

  // Add realistic think time between requests
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s think time
}

export function teardown() {
  console.log('MCP tools load test completed');
}