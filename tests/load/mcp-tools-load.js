// MCP Tools Specific Load Testing
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for MCP tools
export let mcpErrorRate = new Rate('mcp_errors');
export let searchDuration = new Trend('search_duration');
export let explainDuration = new Trend('explain_duration');
export let analysisDuration = new Trend('analysis_duration');

// Test configuration focused on MCP tools
export let options = {
  stages: [
    // Initial load
    { duration: '1m', target: 10 },
    // Moderate concurrent users
    { duration: '2m', target: 25 },
    // High load on MCP tools
    { duration: '3m', target: 75 },
    // Maximum sustained load
    { duration: '2m', target: 150 },
    // Scale down
    { duration: '1m', target: 25 },
    // Recovery
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    mcp_errors: ['rate<0.05'], // MCP error rate under 5%
    search_duration: ['p(95)<1000'], // 95% of searches under 1s
    explain_duration: ['p(95)<2000'], // 95% of explanations under 2s
    analysis_duration: ['p(95)<3000'], // 95% of analysis under 3s
    http_req_duration: ['p(95)<2000'], // Overall requests under 2s
  },
  insecureSkipTLSVerify: true,
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// MCP tool test scenarios
const MCP_SCENARIOS = [
  {
    name: 'search_code',
    weight: 40, // 40% of requests
    payload: {
      tool: 'search_code',
      arguments: {
        query: 'user authentication and authorization',
        codebase_id: 'test-codebase',
        max_results: 10,
        include_context: true,
      },
    },
    expectedDuration: 1000, // ms
  },
  {
    name: 'explain_function',
    weight: 25, // 25% of requests
    payload: {
      tool: 'explain_function',
      arguments: {
        function_name: 'UserService.authenticate',
        codebase_id: 'test-codebase',
        include_examples: true,
      },
    },
    expectedDuration: 2000, // ms
  },
  {
    name: 'find_references',
    weight: 15, // 15% of requests
    payload: {
      tool: 'find_references',
      arguments: {
        symbol: 'DatabaseService',
        codebase_id: 'test-codebase',
        include_type: 'all',
      },
    },
    expectedDuration: 1500, // ms
  },
  {
    name: 'analyze_security',
    weight: 10, // 10% of requests
    payload: {
      tool: 'analyze_security',
      arguments: {
        file_path: 'src/auth/user.service.ts',
        codebase_id: 'test-codebase',
        severity_level: 'medium',
      },
    },
    expectedDuration: 3000, // ms
  },
  {
    name: 'check_complexity',
    weight: 5, // 5% of requests
    payload: {
      tool: 'check_complexity',
      arguments: {
        target: 'src/controllers/user.controller.ts',
        codebase_id: 'test-codebase',
        metrics: ['cyclomatic', 'cognitive'],
      },
    },
    expectedDuration: 1000, // ms
  },
  {
    name: 'get_api_endpoints',
    weight: 3, // 3% of requests
    payload: {
      tool: 'get_api_endpoints',
      arguments: {
        codebase_id: 'test-codebase',
        include_methods: ['GET', 'POST'],
      },
    },
    expectedDuration: 2000, // ms
  },
  {
    name: 'trace_data_flow',
    weight: 2, // 2% of requests
    payload: {
      tool: 'trace_data_flow',
      arguments: {
        function_name: 'processRequest',
        codebase_id: 'test-codebase',
        depth: 3,
      },
    },
    expectedDuration: 2500, // ms
  },
];

// Weighted scenario selection
function selectScenario() {
  const totalWeight = MCP_SCENARIOS.reduce((sum, scenario) => sum + scenario.weight, 0);
  let random = Math.random() * totalWeight;

  for (const scenario of MCP_SCENARIOS) {
    random -= scenario.weight;
    if (random <= 0) {
      return scenario;
    }
  }

  return MCP_SCENARIOS[0]; // fallback
}

export default function() {
  const scenario = selectScenario();
  testMCPTool(scenario);

  // Variable think time based on tool complexity
  const thinkTime = Math.random() * 3 + 1; // 1-4 seconds
  sleep(thinkTime);
}

function testMCPTool(scenario) {
  const startTime = Date.now();

  // Randomize some parameters for variety
  const payload = JSON.stringify({
    ...scenario.payload,
    arguments: {
      ...scenario.payload.arguments,
      // Add randomization
      max_results: scenario.payload.arguments.max_results ?
        Math.floor(Math.random() * 20) + 5 : undefined,
      include_context: Math.random() > 0.3,
      request_id: `load-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    },
  });

  const response = http.post(`${BASE_URL}/api/tools/${scenario.name}`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': `load-test-${Date.now()}`,
    },
    timeout: '30s',
  });

  const duration = Date.now() - startTime;

  // Tool-specific metric recording
  switch (scenario.name) {
    case 'search_code':
      searchDuration.add(duration);
      break;
    case 'explain_function':
      explainDuration.add(duration);
      break;
    case 'analyze_security':
    case 'trace_data_flow':
    case 'check_complexity':
      analysisDuration.add(duration);
      break;
  }

  let success = check(response, {
    [`MCP ${scenario.name} status is 200`]: (r) => r.status === 200,
    [`MCP ${scenario.name} response time < ${scenario.expectedDuration}ms`]: (r) => duration < scenario.expectedDuration,
    [`MCP ${scenario.name} has valid JSON response`]: (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
    [`MCP ${scenario.name} has expected response structure`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return validateToolResponse(scenario.name, body);
      } catch {
        return false;
      }
    },
  });

  // Additional checks for specific tools
  if (scenario.name === 'search_code' && success) {
    check(response, {
      'search results are array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.results);
        } catch {
          return false;
        }
      },
      'search results have required fields': (r) => {
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
  }

  if (scenario.name === 'explain_function' && success) {
    check(response, {
      'explanation contains text': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.explanation && typeof body.explanation === 'string' && body.explanation.length > 50;
        } catch {
          return false;
        }
      },
    });
  }

  mcpErrorRate.add(!success);

  // Log slow responses for analysis
  if (duration > scenario.expectedDuration * 1.5) {
    console.warn(`Slow MCP response: ${scenario.name} took ${duration}ms (expected <${scenario.expectedDuration}ms)`);
  }
}

function validateToolResponse(toolName, body) {
  switch (toolName) {
    case 'search_code':
      return body.results && Array.isArray(body.results);
    case 'explain_function':
      return body.explanation && typeof body.explanation === 'string';
    case 'find_references':
      return body.references && Array.isArray(body.references);
    case 'analyze_security':
      return body.issues && Array.isArray(body.issues);
    case 'check_complexity':
      return body.metrics && typeof body.metrics === 'object';
    case 'get_api_endpoints':
      return body.endpoints && Array.isArray(body.endpoints);
    case 'trace_data_flow':
      return body.flow && Array.isArray(body.flow);
    case 'find_duplicates':
      return body.duplicates && Array.isArray(body.duplicates);
    case 'suggest_refactoring':
      return body.suggestions && Array.isArray(body.suggestions);
    default:
      return true; // Unknown tool, assume valid
  }
}

export function setup() {
  console.log('Starting MCP Tools load test');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Total scenarios: ${MCP_SCENARIOS.length}`);

  // Verify MCP server is available
  const healthResponse = http.get(`${BASE_URL}/health`, {
    timeout: '10s',
  });

  if (healthResponse.status !== 200) {
    throw new Error(`MCP server health check failed: ${healthResponse.status}`);
  }

  console.log('MCP server health check passed');
}

export function teardown() {
  console.log('MCP Tools load test completed');

  // Check server health after stress test
  const healthResponse = http.get(`${BASE_URL}/health`, {
    timeout: '10s',
  });

  if (healthResponse.status === 200) {
    console.log('MCP server remains healthy after load test');
  } else {
    console.error(`MCP server health degraded after load test: ${healthResponse.status}`);
  }
}