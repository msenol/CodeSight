import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics for detailed performance analysis
const indexingDuration = new Trend('indexing_duration');
const queryResponseTime = new Trend('query_response_time');
// const embeddingGenerationTime = new Trend('embedding_generation_time'); // Unused variable
const cacheHitRate = new Rate('cache_hit_rate');
const errorRate = new Rate('errors');
const throughputCounter = new Counter('requests_total');

// Performance test configuration
export const options = {
  scenarios: {
    // Test indexing performance with different codebase sizes
    indexing_performance: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 3,
      maxDuration: '30m',
      tags: { test_type: 'indexing' },
    },
    // Test query performance under load
    query_performance: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 5,
      maxVUs: 20,
      stages: [
        { duration: '2m', target: 5 }, // 5 queries/sec
        { duration: '5m', target: 10 }, // 10 queries/sec
        { duration: '2m', target: 20 }, // 20 queries/sec
        { duration: '1m', target: 0 }, // ramp down
      ],
      tags: { test_type: 'query' },
    },
    // Test concurrent operations
    concurrent_operations: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      tags: { test_type: 'concurrent' },
    },
  },
  thresholds: {
    // Indexing performance thresholds
    'indexing_duration{codebase_size:small}': ['p(95)<5000'], // <5s for small
    'indexing_duration{codebase_size:medium}': ['p(95)<30000'], // <30s for medium
    'indexing_duration{codebase_size:large}': ['p(95)<300000'], // <5min for large

    // Query performance thresholds
    'query_response_time{query_type:simple}': ['p(95)<50'], // <50ms for simple
    'query_response_time{query_type:complex}': ['p(95)<500'], // <500ms for complex
    'query_response_time{query_type:semantic}': ['p(95)<1000'], // <1s for semantic

    // Cache performance
    cache_hit_rate: ['rate>0.7'], // >70% cache hit rate

    // Error rates
    errors: ['rate<0.01'], // <1% error rate

    // Overall performance
    http_req_duration: ['p(95)<2000'], // 95% under 2s
    http_req_failed: ['rate<0.01'], // <1% failure rate
  },
};

const BASE_URL = (typeof __ENV !== 'undefined' && __ENV.BASE_URL) || 'http://localhost:4000';
const API_BASE = `${BASE_URL}/api`;

// Test data for different codebase sizes
const codebaseConfigs = {
  small: {
    name: 'small-test-codebase',
    fileCount: 50,
    expectedIndexTime: 5000,
    tag: 'small',
  },
  medium: {
    name: 'medium-test-codebase',
    fileCount: 500,
    expectedIndexTime: 30000,
    tag: 'medium',
  },
  large: {
    name: 'large-test-codebase',
    fileCount: 2000,
    expectedIndexTime: 300000,
    tag: 'large',
  },
};

// Query test scenarios
const queryScenarios = {
  simple: {
    queries: ['function main', 'class User', 'import express'],
    expectedTime: 50,
    tag: 'simple',
  },
  complex: {
    queries: [
      'where is user authentication implemented?',
      'show all API endpoints that modify user data',
      'find functions with high cyclomatic complexity',
    ],
    expectedTime: 500,
    tag: 'complex',
  },
  semantic: {
    queries: [
      'trace the data flow from REST API to database',
      'find security vulnerabilities in authentication code',
      'explain the main application architecture',
    ],
    expectedTime: 1000,
    tag: 'semantic',
  },
};

export function setup() {
  console.log('Starting performance test setup...');

  // Verify server is ready
  const healthResponse = http.get(`${API_BASE}/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`Server not ready: ${healthResponse.status}`);
  }

  return {
    serverReady: true,
    testStartTime: Date.now(),
  };
}

export default function () {
  const scenario = (typeof __ENV !== 'undefined' && __ENV.K6_SCENARIO_NAME) || 'query_performance';

  switch (scenario) {
    case 'indexing_performance':
      testIndexingPerformance();
      break;
    case 'query_performance':
      testQueryPerformance();
      break;
    case 'concurrent_operations':
      testConcurrentOperations();
      break;
    default:
      testQueryPerformance(); // Default test
  }

  throughputCounter.add(1);
}

function testIndexingPerformance() {
  const configs = Object.values(codebaseConfigs);
  const config = configs[Math.floor(Math.random() * configs.length)];

  console.log(`Testing indexing performance for ${config.tag} codebase`);

  // Create test codebase
  const createPayload = {
    name: `${config.name}-${Date.now()}`,
    path: `/tmp/test-${config.tag}`,
    languages: ['typescript', 'javascript', 'python'],
    exclude_patterns: ['node_modules', '*.log'],
  };

  const createResponse = http.post(`${API_BASE}/codebases`, JSON.stringify(createPayload), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (createResponse.status !== 201) {
    errorRate.add(1);
    return;
  }

  const codebaseData = JSON.parse(createResponse.body);
  const codebaseId = codebaseData.id;

  // Start indexing and measure time
  const indexStartTime = Date.now();

  const indexResponse = http.post(
    `${API_BASE}/codebases/${codebaseId}/index`,
    JSON.stringify({ parallel_workers: 4 }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const indexSuccess = check(indexResponse, {
    'indexing started successfully': r => r.status === 202,
  });

  if (!indexSuccess) {
    errorRate.add(1);
    return;
  }

  // Poll for indexing completion
  let indexingComplete = false;
  let pollCount = 0;
  const maxPolls = Math.ceil(config.expectedIndexTime / 1000); // Poll every second

  while (!indexingComplete && pollCount < maxPolls) {
    sleep(1);
    pollCount++;

    const statusResponse = http.get(`${API_BASE}/codebases/${codebaseId}`);

    if (statusResponse.status === 200) {
      const statusData = JSON.parse(statusResponse.body);
      if (statusData.status === 'indexed') {
        indexingComplete = true;
        const indexDuration = Date.now() - indexStartTime;

        indexingDuration.add(indexDuration, { codebase_size: config.tag });

        console.log(`Indexing completed for ${config.tag} codebase in ${indexDuration}ms`);
      } else if (statusData.status === 'error') {
        errorRate.add(1);
        console.error(`Indexing failed for ${config.tag} codebase`);
        break;
      }
    }
  }

  if (!indexingComplete) {
    errorRate.add(1);
    console.error(`Indexing timeout for ${config.tag} codebase`);
  }

  // Cleanup
  http.del(`${API_BASE}/codebases/${codebaseId}`);
}

function testQueryPerformance() {
  // Use a pre-existing test codebase or create one
  const codebaseId = getOrCreateTestCodebase();

  if (!codebaseId) {
    errorRate.add(1);
    return;
  }

  // Test different query types
  const scenarioTypes = Object.keys(queryScenarios);
  const scenarioType = scenarioTypes[Math.floor(Math.random() * scenarioTypes.length)];
  const scenario = queryScenarios[scenarioType];

  const query = scenario.queries[Math.floor(Math.random() * scenario.queries.length)];

  const queryStartTime = Date.now();

  const queryPayload = {
    query_text: query,
    codebase_id: codebaseId,
    max_results: 10,
    include_context: true,
  };

  const response = http.post(`${API_BASE}/queries`, JSON.stringify(queryPayload), {
    headers: { 'Content-Type': 'application/json' },
  });

  const queryDuration = Date.now() - queryStartTime;

  const success = check(response, {
    'query status is 200': r => r.status === 200,
    'query has results': r => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data.results);
      } catch {
        return false;
      }
    },
  });

  if (success) {
    queryResponseTime.add(queryDuration, { query_type: scenario.tag });

    // Check if response was cached
    try {
      const responseData = JSON.parse(response.body);
      if (responseData.metadata && responseData.metadata.cache_hit) {
        cacheHitRate.add(1);
      } else {
        cacheHitRate.add(0);
      }
    } catch {
      // Ignore parsing errors for cache hit detection
    }
  } else {
    errorRate.add(1);
  }
}

function testConcurrentOperations() {
  // Test multiple operations concurrently
  const operations = [
    () => testQueryPerformance(),
    () => testMCPToolCall('search_code'),
    () => testMCPToolCall('get_api_endpoints'),
    () => testHealthCheck(),
  ];

  const operation = operations[Math.floor(Math.random() * operations.length)];
  operation();

  sleep(0.1); // Small delay between concurrent operations
}

function testMCPToolCall(toolName) {
  const codebaseId = getOrCreateTestCodebase();

  if (!codebaseId) {
    errorRate.add(1);
    return;
  }

  const toolArguments = {
    search_code: {
      query: 'function authentication',
      codebase_id: codebaseId,
      max_results: 5,
    },
    get_api_endpoints: {
      codebase_id: codebaseId,
      filter_method: 'all',
    },
  };

  const startTime = Date.now();

  const response = http.post(
    `${API_BASE}/mcp/tools/${toolName}`,
    JSON.stringify({ arguments: toolArguments[toolName] }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const duration = Date.now() - startTime;

  const success = check(response, {
    [`${toolName} status is 200`]: r => r.status === 200,
    [`${toolName} response time reasonable`]: () => duration < 2000,
  });

  if (!success) {
    errorRate.add(1);
  }
}

function testHealthCheck() {
  const response = http.get(`${API_BASE}/health`);

  const success = check(response, {
    'health check status is 200': r => r.status === 200,
    'health check response time < 100ms': r => r.timings.duration < 100,
  });

  if (!success) {
    errorRate.add(1);
  }
}

function getOrCreateTestCodebase() {
  // For simplicity, return a mock codebase ID
  // In a real test, this would check for existing test codebases
  return 'test-codebase-id-' + Math.floor(Math.random() * 1000);
}

export function teardown(data) {
  const testDuration = Date.now() - data.testStartTime;
  console.log(`Performance test completed in ${testDuration}ms`);

  // Final health check
  const healthResponse = http.get(`${API_BASE}/health`);

  if (healthResponse.status === 200) {
    console.log('Server remained healthy throughout performance test');
  } else {
    console.error(`Server health degraded: ${healthResponse.status}`);
  }
}
