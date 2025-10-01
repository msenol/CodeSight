import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
// import { WebSocket } from 'k6/ws'; // Unused import

// Custom metrics
const errorRate = new Rate('mcp_errors');
const toolExecutionTime = new Rate('tool_execution_time');

// Test configuration for MCP-specific load testing
export const options = {
  scenarios: {
    mcp_tools_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 5 }, // Ramp up to 5 concurrent MCP clients
        { duration: '3m', target: 5 }, // Stay at 5 clients
        { duration: '1m', target: 10 }, // Ramp up to 10 clients
        { duration: '3m', target: 10 }, // Stay at 10 clients
        { duration: '1m', target: 0 }, // Ramp down
      ],
    },
    concurrent_queries: {
      executor: 'constant-arrival-rate',
      rate: 20, // 20 queries per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 10,
      maxVUs: 50,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of MCP tool calls should be below 2s
    http_req_failed: ['rate<0.05'], // Error rate should be less than 5%
    mcp_errors: ['rate<0.05'], // MCP-specific error rate
  },
};

// Test configuration
const BASE_URL = (typeof __ENV !== 'undefined' && __ENV.BASE_URL) || 'http://localhost:4000';
const MCP_BASE = `${BASE_URL}/api/mcp/tools`;

// MCP tool test scenarios
const mcpToolScenarios = [
  {
    tool: 'search_code',
    arguments: {
      query: 'authentication function',
      codebase_id: 'test-codebase-id',
      context_lines: 3,
      max_results: 10,
    },
    expectedResponseTime: 500,
  },
  {
    tool: 'explain_function',
    arguments: {
      entity_id: 'test-entity-id',
      include_callers: true,
      include_callees: true,
      include_complexity: true,
    },
    expectedResponseTime: 1000,
  },
  {
    tool: 'find_references',
    arguments: {
      entity_id: 'test-entity-id',
      include_tests: true,
      include_indirect: false,
    },
    expectedResponseTime: 800,
  },
  {
    tool: 'trace_data_flow',
    arguments: {
      start_point: 'REST API /users',
      end_point: 'database table users',
      codebase_id: 'test-codebase-id',
      max_depth: 10,
    },
    expectedResponseTime: 1500,
  },
  {
    tool: 'analyze_security',
    arguments: {
      codebase_id: 'test-codebase-id',
      patterns: ['sql_injection', 'xss', 'csrf'],
      severity_threshold: 'medium',
    },
    expectedResponseTime: 2000,
  },
  {
    tool: 'get_api_endpoints',
    arguments: {
      codebase_id: 'test-codebase-id',
      filter_method: 'all',
      include_schemas: true,
    },
    expectedResponseTime: 600,
  },
  {
    tool: 'check_complexity',
    arguments: {
      entity_id: 'test-entity-id',
      metric_types: ['cyclomatic', 'cognitive', 'maintainability'],
    },
    expectedResponseTime: 400,
  },
  {
    tool: 'find_duplicates',
    arguments: {
      codebase_id: 'test-codebase-id',
      similarity_threshold: 0.8,
      min_lines: 5,
      ignore_whitespace: true,
    },
    expectedResponseTime: 1200,
  },
  {
    tool: 'suggest_refactoring',
    arguments: {
      entity_id: 'test-entity-id',
      refactoring_types: ['extract_method', 'rename', 'simplify'],
    },
    expectedResponseTime: 1000,
  },
];

export function setup() {
  // Verify MCP server is available
  const healthResponse = http.get(`${BASE_URL}/api/health`);

  if (healthResponse.status !== 200) {
    throw new Error(`MCP server not available: ${healthResponse.status}`);
  }

  console.log('MCP server is available for load testing');
  return { serverReady: true };
}

export default function (data) {
  if (!data.serverReady) {
    console.error('Server not ready for testing');
    return;
  }

  // Test random MCP tool
  const scenario = mcpToolScenarios[Math.floor(Math.random() * mcpToolScenarios.length)];
  testMCPTool(scenario);

  // Test concurrent tool execution
  if (Math.random() < 0.3) {
    // 30% chance
    testConcurrentToolExecution();
  }

  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

function testMCPTool(scenario) {
  const startTime = Date.now();

  const response = http.post(
    `${MCP_BASE}/${scenario.tool}`,
    JSON.stringify({
      arguments: scenario.arguments,
      context: {
        timestamp: new Date().toISOString(),
        test_run: true,
      },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'k6-load-test/1.0',
      },
      timeout: '30s',
    },
  );

  const executionTime = Date.now() - startTime;

  const success = check(response, {
    [`${scenario.tool} status is 200`]: r => r.status === 200,
    [`${scenario.tool} response time < ${scenario.expectedResponseTime}ms`]: r =>
      r.timings.duration < scenario.expectedResponseTime,
    [`${scenario.tool} has valid MCP response`]: r => {
      try {
        const data = JSON.parse(r.body);
        return data.result !== undefined && data.metadata !== undefined;
      } catch (e) {
        console.error(`Invalid JSON response for ${scenario.tool}: ${e.message}`);
        return false;
      }
    },
    [`${scenario.tool} execution time reasonable`]: () =>
      executionTime < scenario.expectedResponseTime * 2,
  });

  if (!success) {
    console.error(`MCP tool ${scenario.tool} failed: ${response.status} - ${response.body}`);
  }

  errorRate.add(!success);
  toolExecutionTime.add(executionTime);
}

function testConcurrentToolExecution() {
  // Test multiple tools concurrently to simulate real MCP usage
  const concurrentTools = [
    mcpToolScenarios[0], // search_code
    mcpToolScenarios[5], // get_api_endpoints
    mcpToolScenarios[6], // check_complexity
  ];

  // const promises = concurrentTools.map(scenario => {
  //   return new Promise(resolve => {
  //     const response = http.post(
  //       `${MCP_BASE}/${scenario.tool}`,
  //       JSON.stringify({ arguments: scenario.arguments }),
  //       {
  //         headers: { 'Content-Type': 'application/json' },
  //         timeout: '15s',
  //       },
  //     );
  //     resolve({ scenario, response });
  //   });
  // });

  // Note: k6 doesn't support Promise.all, so we test sequentially but quickly
  concurrentTools.forEach(scenario => {
    const response = http.post(
      `${MCP_BASE}/${scenario.tool}`,
      JSON.stringify({ arguments: scenario.arguments }),
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: '10s',
      },
    );

    const success = check(response, {
      [`concurrent ${scenario.tool} succeeds`]: r => r.status === 200,
    });

    errorRate.add(!success);
  });
}

// Test MCP protocol compliance
export function testMCPProtocolCompliance() {
  // Test tool discovery
  const toolsResponse = http.get(`${BASE_URL}/api/mcp/tools`);

  check(toolsResponse, {
    'tools discovery status is 200': r => r.status === 200,
    'tools discovery returns array': r => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data.tools);
      } catch {
        return false;
      }
    },
  });

  // Test invalid tool call
  const invalidResponse = http.post(`${MCP_BASE}/invalid_tool`, JSON.stringify({ arguments: {} }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(invalidResponse, {
    'invalid tool returns 404': r => r.status === 404,
  });

  // Test malformed request
  const malformedResponse = http.post(`${MCP_BASE}/search_code`, 'invalid json', {
    headers: { 'Content-Type': 'application/json' },
  });

  check(malformedResponse, {
    'malformed request returns 400': r => r.status === 400,
  });
}

export function teardown() {
  console.log('MCP load test completed');

  // Test final server health
  const healthResponse = http.get(`${BASE_URL}/api/health`);

  if (healthResponse.status === 200) {
    console.log('Server remained healthy throughout load test');
  } else {
    console.error(`Server health degraded: ${healthResponse.status}`);
  }
}
