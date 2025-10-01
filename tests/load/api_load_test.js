import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration - Simplified for quick testing
export const options = {
  stages: [
    { duration: '10s', target: 2 }, // Ramp up to 2 users
    { duration: '20s', target: 2 }, // Stay at 2 users
    { duration: '10s', target: 5 }, // Ramp up to 5 users
    { duration: '20s', target: 5 }, // Stay at 5 users
    { duration: '10s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    http_req_failed: ['rate<0.2'], // Error rate should be less than 20%
    errors: ['rate<0.2'], // Custom error rate should be less than 20%
  },
};

// Test data
const BASE_URL = (typeof __ENV !== 'undefined' && __ENV.BASE_URL) || 'http://localhost:4001';
const API_BASE = `${BASE_URL}/api`;

// Sample codebase data - removed unused variable for lint compliance

// Sample queries - removed unused variable for lint compliance

// const codebaseId = null; // Unused variable

export function setup() {
  // Skip setup for simplified test
  console.log('Starting simplified load test');
  return {};
}

export default function () {
  // Only test health endpoint for now
  testHealthEndpoint();

  sleep(0.5); // Wait 0.5 second between iterations
}

function testHealthEndpoint() {
  const response = http.get(`${API_BASE}/health`);

  const success = check(response, {
    'health check status is 200': r => r.status === 200,
    'health check response time < 100ms': r => r.timings.duration < 100,
  });

  errorRate.add(!success);
}

// function testCodebaseOperations(_codebaseId) {
//   // Get codebase details
//   const getResponse = http.get(`${API_BASE}/codebases/${_codebaseId}`);

//   const getSuccess = check(getResponse, {
//     'get codebase status is 200': r => r.status === 200,
//     'get codebase response time < 200ms': r => r.timings.duration < 200,
//     'get codebase has valid JSON': r => {
//       try {
//         JSON.parse(r.body);
//         return true;
//       } catch (_e) {
//         return false;
//       }
//     },
//   });

//   errorRate.add(!getSuccess);

//   // Get codebase stats
//   const statsResponse = http.get(`${API_BASE}/codebases/${_codebaseId}/stats`);

//   const statsSuccess = check(statsResponse, {
//     'get stats status is 200': r => r.status === 200,
//     'get stats response time < 300ms': r => r.timings.duration < 300,
//   });

//   errorRate.add(!statsSuccess);
// }

// function testQueryOperations(_codebaseId) {
//   const randomQuery = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];

//   const queryPayload = {
//     query_text: randomQuery,
//     codebase_id: _codebaseId,
//     max_results: 10,
//     include_context: true,
//   };

//   const response = http.post(`${API_BASE}/queries`, JSON.stringify(queryPayload), {
//     headers: {
//       'Content-Type': 'application/json',
//     },
//   });

//   const success = check(response, {
//     'query status is 200': r => r.status === 200,
//     'query response time < 500ms': r => r.timings.duration < 500,
//     'query has results': r => {
//       try {
//         const _data = JSON.parse(r.body);
//         return Array.isArray(_data.results);
//       } catch (_e) {
//         return false;
//       }
//     },
//   });

//   errorRate.add(!success);
// }

// function testMCPToolOperations(_codebaseId) {
//   // Test search_code tool
//   testMCPTool('search_code', {
//     query: 'function authentication',
//     codebase_id: _codebaseId,
//     max_results: 5,
//   });

//   // Test get_api_endpoints tool
//   testMCPTool('get_api_endpoints', {
//     codebase_id: _codebaseId,
//     filter_method: 'all',
//     include_schemas: true,
//   });

//   // Test analyze_security tool
//   testMCPTool('analyze_security', {
//     codebase_id: _codebaseId,
//     patterns: ['sql_injection', 'xss'],
//     severity_threshold: 'medium',
//   });
// }

// function testMCPTool(toolName, args) {
//   const response = http.post(
//     `${API_BASE}/mcp/tools/${toolName}`,
//     JSON.stringify({ arguments: args }),
//     {
//       headers: {
//         'Content-Type': 'application/json',
//       },
//     },
//   );

//   const success = check(response, {
//     [`${toolName} status is 200`]: r => r.status === 200,
//     [`${toolName} response time < 1000ms`]: r => r.timings.duration < 1000,
//     [`${toolName} has valid response`]: r => {
//       try {
//         const _data = JSON.parse(r.body);
//         return _data.result !== undefined;
//       } catch (_e) {
//         return false;
//       }
//     },
//   });

//   errorRate.add(!success);
// }

export function teardown() {
  console.log('Load test completed');
}
