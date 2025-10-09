// Stress Testing for CodeSight MCP Server
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Stress test metrics
export let stressErrors = new Rate('stress_errors');
export let memoryUsage = new Trend('memory_usage');
export let cpuUsage = new Trend('cpu_usage');
export let concurrentUsers = new Trend('concurrent_users');
export let throughput = new Rate('throughput');

// Performance degradation tracking
export let responseTimeIncrease = new Trend('response_time_increase');
export let errorRateIncrease = new Rate('error_rate_increase');

export let options = {
  stages: [
    // Ramp up quickly to stress level
    { duration: '30s', target: 50 },
    // Sustained stress
    { duration: '2m', target: 100 },
    // Peak stress - push to limits
    { duration: '3m', target: 200 },
    // Maximum stress - test breaking point
    { duration: '2m', target: 500 },
    // Sustained maximum
    { duration: '1m', target: 500 },
    // Gradual recovery
    { duration: '2m', target: 100 },
    // Cool down
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    // More lenient thresholds for stress testing
    http_req_duration: ['p(95)<5000'], // 5s tolerance under stress
    http_req_failed: ['rate<0.2'], // Allow 20% errors under extreme stress
    stress_errors: ['rate<0.25'],
    throughput: ['rate>10'], // Minimum throughput rate
  },
  insecureSkipTLSVerify: true,
  noConnectionReuse: true, // Disable connection reuse to stress connection handling
  noVUConnectionReuse: true, // Each VU creates new connections
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// Stress test scenarios - more aggressive
const STRESS_SCENARIOS = [
  // Heavy search operations
  {
    name: 'intensive_search',
    weight: 35,
    func: () => intensiveSearch(),
  },
  // Concurrent indexing
  {
    name: 'concurrent_indexing',
    weight: 20,
    func: () => concurrentIndexing(),
  },
  // Complex analysis operations
  {
    name: 'complex_analysis',
    weight: 20,
    func: () => complexAnalysis(),
  },
  // Rapid API calls
  {
    name: 'rapid_api_calls',
    weight: 15,
    func: () => rapidAPICalls(),
  },
  // Memory pressure
  {
    name: 'memory_pressure',
    weight: 10,
    func: () => memoryPressure(),
  },
];

// Baseline metrics collected at start
let baselineResponseTime = 0;
let baselineErrorRate = 0;

export function setup() {
  console.log('Starting stress test - pushing system to limits');
  console.log(`Target: ${BASE_URL}`);

  // Collect baseline metrics
  console.log('Collecting baseline metrics...');
  const baselineResults = runBaselineTest();
  baselineResponseTime = baselineResults.avgResponseTime;
  baselineErrorRate = baselineResults.errorRate;

  console.log(`Baseline Response Time: ${baselineResponseTime}ms`);
  console.log(`Baseline Error Rate: ${(baselineErrorRate * 100).toFixed(2)}%`);

  // Check system health before stress
  const healthResponse = http.get(`${BASE_URL}/health`, { timeout: '10s' });
  if (healthResponse.status !== 200) {
    throw new Error(`System unhealthy before stress test: ${healthResponse.status}`);
  }

  return { baselineResponseTime, baselineErrorRate };
}

export default function(data) {
  // Track concurrent users estimation
  concurrentUsers.add(__VU * 2); // Rough estimate

  // Select stress scenario
  const scenario = selectStressScenario();
  scenario.func();

  // Minimal think time for stress testing
  sleep(Math.random() * 0.5 + 0.1); // 0.1-0.6 seconds
}

function selectStressScenario() {
  const totalWeight = STRESS_SCENARIOS.reduce((sum, scenario) => sum + scenario.weight, 0);
  let random = Math.random() * totalWeight;

  for (const scenario of STRESS_SCENARIOS) {
    random -= scenario.weight;
    if (random <= 0) {
      return scenario;
    }
  }

  return STRESS_SCENARIOS[0];
}

function intensiveSearch() {
  const queries = [
    'complex user authentication and authorization system with role-based access control',
    'database connection pooling and transaction management across multiple services',
    'advanced error handling and retry mechanisms with circuit breaker patterns',
    'performance optimization techniques for large-scale distributed systems',
    'security vulnerability assessment and penetration testing methodologies',
    'microservices architecture with service mesh and API gateway patterns',
    'real-time data processing and streaming analytics pipelines',
    'machine learning model deployment and monitoring frameworks',
    'container orchestration and Kubernetes cluster management',
    'GraphQL schema design and resolver optimization strategies',
  ];

  const query = queries[Math.floor(Math.random() * queries.length)];
  const startTime = Date.now();

  const response = http.post(`${BASE_URL}/api/tools/search_code`, JSON.stringify({
    tool: 'search_code',
    arguments: {
      query: query,
      codebase_id: 'test-codebase',
      max_results: 50, // Large result set
      include_context: true,
      include_related: true,
      fuzzy_search: true,
    },
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Stress-Test': 'intensive-search',
    },
    timeout: '60s', // Longer timeout for complex queries
  });

  const responseTime = Date.now() - startTime;

  // Track performance degradation
  if (baselineResponseTime > 0) {
    const increaseRatio = responseTime / baselineResponseTime;
    responseTimeIncrease.add(increaseRatio);
  }

  const success = check(response, {
    'intensive search status is 200': (r) => r.status === 200,
    'intensive search response time < 10s': (r) => responseTime < 10000,
    'intensive search has valid response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.results && Array.isArray(body.results);
      } catch {
        return false;
      }
    },
  });

  stressErrors.add(!success);
  throughput.add(1);
}

function concurrentIndexing() {
  // Simulate concurrent indexing operations
  const testPaths = [
    `/tmp/test-project-${Math.random()}`,
    `/tmp/large-codebase-${Math.random()}`,
    `/tmp/monorepo-${Math.random()}`,
  ];

  const path = testPaths[Math.floor(Math.random() * testPaths.length)];

  const response = http.post(`${BASE_URL}/api/codebases/index`, JSON.stringify({
    codebase_id: 'test-codebase',
    path: path,
    force_reindex: Math.random() > 0.7, // 30% chance of forced reindex
    parallel_workers: Math.floor(Math.random() * 8) + 1,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Stress-Test': 'concurrent-indexing',
    },
    timeout: '120s', // Indexing can take longer
  });

  const success = check(response, {
    'concurrent indexing accepted': (r) => r.status === 200 || r.status === 202,
    'concurrent indexing has job ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.job_id || body.message;
      } catch {
        return false;
      }
    },
  });

  stressErrors.add(!success);
  throughput.add(1);
}

function complexAnalysis() {
  const analysisTools = [
    'analyze_security',
    'trace_data_flow',
    'check_complexity',
    'suggest_refactoring',
  ];

  const tool = analysisTools[Math.floor(Math.random() * analysisTools.length)];
  const startTime = Date.now();

  let payload;
  switch (tool) {
    case 'analyze_security':
      payload = {
        tool: 'analyze_security',
        arguments: {
          codebase_id: 'test-codebase',
          severity_level: 'low', // Check everything
          include_suggestions: true,
          deep_scan: true,
        },
      };
      break;
    case 'trace_data_flow':
      payload = {
        tool: 'trace_data_flow',
        arguments: {
          function_name: 'processRequest',
          codebase_id: 'test-codebase',
          depth: 5, // Deep trace
          include_external: true,
        },
      };
      break;
    case 'check_complexity':
      payload = {
        tool: 'check_complexity',
        arguments: {
          target: 'entire-codebase',
          codebase_id: 'test-codebase',
          metrics: ['cyclomatic', 'cognitive', 'maintainability'],
          include_trends: true,
        },
      };
      break;
    case 'suggest_refactoring':
      payload = {
        tool: 'suggest_refactoring',
        arguments: {
          codebase_id: 'test-codebase',
          analysis_depth: 'deep',
          prioritize_by: 'impact',
          include_examples: true,
        },
      };
      break;
  }

  const response = http.post(`${BASE_URL}/api/tools/${tool}`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'X-Stress-Test': 'complex-analysis',
    },
    timeout: '90s', // Complex analysis needs more time
  });

  const responseTime = Date.now() - startTime;

  const success = check(response, {
    [`complex ${tool} status is 200`]: (r) => r.status === 200,
    [`complex ${tool} response time < 30s`]: (r) => responseTime < 30000,
    [`complex ${tool} has valid response`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.results || body.issues || body.flow || body.metrics || body.suggestions;
      } catch {
        return false;
      }
    },
  });

  stressErrors.add(!success);
  throughput.add(1);
}

function rapidAPICalls() {
  // Rapid succession of API calls to stress connection handling
  const endpoints = [
    { method: 'GET', path: '/health' },
    { method: 'GET', path: '/metrics' },
    { method: 'GET', path: '/codebases' },
    { method: 'POST', path: '/queries', body: { query: 'test', codebase_id: 'test' } },
    { method: 'GET', path: '/jobs' },
  ];

  // Make multiple rapid calls
  for (let i = 0; i < 3; i++) {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const startTime = Date.now();

    let response;
    if (endpoint.body) {
      response = http[endpoint.method.toLowerCase()](
        `${BASE_URL}${endpoint.path}`,
        JSON.stringify(endpoint.body),
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Stress-Test': 'rapid-api-calls',
          },
          timeout: '10s',
        }
      );
    } else {
      response = http[endpoint.method.toLowerCase()](
        `${BASE_URL}${endpoint.path}`,
        {
          headers: { 'X-Stress-Test': 'rapid-api-calls' },
          timeout: '10s',
        }
      );
    }

    const responseTime = Date.now() - startTime;

    check(response, {
      [`rapid ${endpoint.method} ${endpoint.path} status ok`]: (r) => r.status >= 200 && r.status < 300,
      [`rapid ${endpoint.method} ${endpoint.path} response time < 2s`]: (r) => responseTime < 2000,
    });

    // Very small delay between rapid calls
    sleep(Math.random() * 0.1);
  }

  throughput.add(3);
}

function memoryPressure() {
  // Operations designed to consume memory
  const response = http.post(`${BASE_URL}/api/tools/search_code`, JSON.stringify({
    tool: 'search_code',
    arguments: {
      query: 'all functions classes and variables in the entire codebase',
      codebase_id: 'test-codebase',
      max_results: 1000, // Very large result set
      include_context: true,
      include_related: true,
      include_full_content: true,
      deep_analysis: true,
    },
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Stress-Test': 'memory-pressure',
    },
    timeout: '120s',
  });

  // Also request system metrics
  const metricsResponse = http.get(`${BASE_URL}/metrics`, {
    headers: { 'X-Stress-Test': 'memory-pressure' },
    timeout: '10s',
  });

  // Parse metrics to track memory usage
  if (metricsResponse.status === 200) {
    try {
      const metricsText = metricsResponse.body;
      const memoryMatch = metricsText.match(/codesight_system_memory_usage_bytes[^}]+} ([\d.]+)/);
      if (memoryMatch) {
        memoryUsage.add(parseFloat(memoryMatch[1]) / 1024 / 1024); // Convert to MB
      }

      const cpuMatch = metricsText.match(/codesight_system_cpu_usage_percent[^}]+} ([\d.]+)/);
      if (cpuMatch) {
        cpuUsage.add(parseFloat(cpuMatch[1]));
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  const success = check(response, {
    'memory pressure search status is 200': (r) => r.status === 200,
    'memory pressure search has large result set': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.results && body.results.length > 100;
      } catch {
        return false;
      }
    },
  });

  stressErrors.add(!success);
  throughput.add(1);
}

function runBaselineTest() {
  // Simple baseline test
  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/tools/search_code`, JSON.stringify({
    tool: 'search_code',
    arguments: {
      query: 'test function',
      codebase_id: 'test-codebase',
      max_results: 5,
    },
  }), { timeout: '10s' });

  const responseTime = Date.now() - startTime;
  const errorRate = response.status !== 200 ? 1 : 0;

  return {
    avgResponseTime: responseTime,
    errorRate: errorRate,
  };
}

export function teardown(data) {
  console.log('Stress test completed');
  console.log('Checking system recovery...');

  // Wait a moment for recovery
  sleep(5);

  // Final health check
  const healthResponse = http.get(`${BASE_URL}/health`, {
    timeout: '30s',
  });

  if (healthResponse.status === 200) {
    console.log('✅ System recovered successfully after stress test');
  } else {
    console.error(`❌ System failed to recover: ${healthResponse.status}`);
    console.error('System may be in degraded state');
  }

  // Check final metrics
  console.log(`Peak Response Time Increase: ${responseTimeIncrease.max ? (responseTimeIncrease.max * 100 - 100).toFixed(1) : 'N/A'}%`);
  console.log(`Peak Error Rate: ${(stressErrors.rate * 100).toFixed(2)}%`);
  console.log(`Peak Memory Usage: ${memoryUsage.max ? memoryUsage.max.toFixed(1) : 'N/A'}MB`);
  console.log(`Peak CPU Usage: ${cpuUsage.max ? cpuUsage.max.toFixed(1) : 'N/A'}%`);
}