/**
 * Search Performance Load Test (T085)
 *
 * Focused load test for search performance under various conditions.
 * Tests different query types, complexity levels, and result sizes.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for search performance
export let searchErrorRate = new Rate('search_errors');
export let searchLatency = new Trend('search_latency');
export let searchResultsCount = new Trend('search_results_count');
export let searchRelevanceScore = new Trend('search_relevance_score');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Warm up
    { duration: '3m', target: 50 },   // Normal load
    { duration: '2m', target: 100 },  // High load
    { duration: '3m', target: 50 },   // Return to normal
    { duration: '1m', target: 0 },    // Cool down
  ],

  thresholds: {
    search_errors: ['rate<0.05'],
    search_latency: ['p(95)<200', 'p(99)<500'],
    search_results_count: ['value>0'],
    http_req_duration: ['p(95)<300'],
  },

  discardResponseBodies: false, // Keep bodies for result analysis
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const API_BASE = `${BASE_URL}/api/v1`;

// Test query sets
const SIMPLE_QUERIES = [
  'function',
  'class',
  'interface',
  'const',
  'let',
  'import',
  'export',
  'async',
  'await',
  'type'
];

const COMPLEX_QUERIES = [
  'function authentication',
  'class UserService',
  'interface DatabaseConnection',
  'async processRequest',
  'const API_KEY',
  'export default',
  'import React from',
  'type Config =',
  'enum UserRole',
  'namespace Utils'
];

const FILTERED_QUERIES = [
  { query: 'function', entity_type: 'function' },
  { query: 'class', entity_type: 'class' },
  { query: 'interface', entity_type: 'interface' },
  { query: 'const', entity_type: 'variable' },
  { query: 'import', entity_type: 'module' }
];

const LONG_TAIL_QUERIES = [
  'authentication middleware',
  'database connection pool',
  'user authentication service',
  'async data processing',
  'error handling utilities',
  'logging configuration',
  'caching mechanisms',
  'validation helpers',
  'react component lifecycle',
  'typescript type definitions'
];

let testCodebaseId;

export function setup() {
  console.log('🔍 Setting up Search Performance Test');

  // Create test codebase with sample data
  const createResponse = http.post(`${API_BASE}/codebases`, JSON.stringify({
    name: 'search-performance-test',
    path: '/tmp/search-test',
    language: 'typescript'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (createResponse.status !== 201) {
    throw new Error('Failed to create test codebase');
  }

  testCodebaseId = JSON.parse(createResponse.body).data.id;
  console.log(`✅ Created test codebase: ${testCodebaseId}`);

  // Index some sample content
  const sampleFiles = [
    {
      path: 'auth/AuthService.ts',
      content: `
export class AuthService {
  async login(username: string, password: string): Promise<boolean> {
    return true;
  }

  async logout(): Promise<void> {
    // Logout logic
  }
}
`
    },
    {
      path: 'utils/Database.ts',
      content: `
export interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string): Promise<any[]>;
}

export class PostgreSQLConnection implements DatabaseConnection {
  constructor(private config: DBConfig) {}

  async connect(): Promise<void> {
    // Connect to PostgreSQL
  }

  async disconnect(): Promise<void> {
    // Disconnect from PostgreSQL
  }

  async query(sql: string): Promise<any[]> {
    return [];
  }
}
`
    },
    {
      path: 'types/index.ts',
      content: `
export type UserRole = 'admin' | 'user' | 'guest';
export interface User {
  id: string;
  username: string;
  role: UserRole;
}
export const API_VERSION = 'v1.0.0';
`
    }
  ];

  for (const file of sampleFiles) {
    const indexResponse = http.post(`${API_BASE}/codebases/${testCodebaseId}/index`, JSON.stringify({
      files: [file],
      force_reindex: false
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (indexResponse.status !== 200 && indexResponse.status !== 202) {
      console.warn(`⚠️ Failed to index file: ${file.path}`);
    }
  }

  // Wait for indexing to complete
  sleep(3);

  return { codebaseId: testCodebaseId };
}

export default function(data) {
  const scenarios = [
    testSimpleQueries,
    testComplexQueries,
    testFilteredQueries,
    testLongTailQueries,
    testConcurrentSearches
  ];

  const selectedScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  selectedScenario(data);

  sleep(Math.random() * 0.5 + 0.5); // 0.5-1 second between searches
}

function testSimpleQueries(data) {
  const query = SIMPLE_QUERIES[Math.floor(Math.random() * SIMPLE_QUERIES.length)];

  const response = http.post(`${API_BASE}/queries`, JSON.stringify({
    codebase_id: data.codebaseId,
    query: query,
    limit: 20
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'simple search status is 200': (r) => r.status === 200,
    'simple search response time < 100ms': (r) => r.timings.duration < 100,
    'simple search has results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data.results.length > 0;
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    const body = JSON.parse(response.body);
    searchResultsCount.add(body.data.results.length);

    // Calculate average relevance score if available
    if (body.data.results.length > 0) {
      const avgRelevance = body.data.results.reduce((sum, result) =>
        sum + (result.relevance_score || result.score || 0), 0) / body.data.results.length;
      searchRelevanceScore.add(avgRelevance);
    }
  }

  searchErrorRate.add(!success);
  searchLatency.add(response.timings.duration);
}

function testComplexQueries(data) {
  const query = COMPLEX_QUERIES[Math.floor(Math.random() * COMPLEX_QUERIES.length)];

  const response = http.post(`${API_BASE}/queries`, JSON.stringify({
    codebase_id: data.codebaseId,
    query: query,
    limit: 10,
    include_snippets: true,
    include_highlights: true
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'complex search status is 200': (r) => r.status === 200,
    'complex search response time < 200ms': (r) => r.timings.duration < 200,
    'complex search has snippets': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data.results.some(r => r.snippet);
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    const body = JSON.parse(response.body);
    searchResultsCount.add(body.data.results.length);
  }

  searchErrorRate.add(!success);
  searchLatency.add(response.timings.duration);
}

function testFilteredQueries(data) {
  const queryConfig = FILTERED_QUERIES[Math.floor(Math.random() * FILTERED_QUERIES.length)];

  const response = http.post(`${API_BASE}/queries`, JSON.stringify({
    codebase_id: data.codebaseId,
    query: queryConfig.query,
    entity_type: queryConfig.entity_type,
    limit: 15
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'filtered search status is 200': (r) => r.status === 200,
    'filtered search response time < 150ms': (r) => r.timings.duration < 150,
    'filtered search respects filter': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data.results.every(r => r.kind === queryConfig.entity_type);
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    const body = JSON.parse(response.body);
    searchResultsCount.add(body.data.results.length);
  }

  searchErrorRate.add(!success);
  searchLatency.add(response.timings.duration);
}

function testLongTailQueries(data) {
  const query = LONG_TAIL_QUERIES[Math.floor(Math.random() * LONG_TAIL_QUERIES.length)];

  const response = http.post(`${API_BASE}/queries`, JSON.stringify({
    codebase_id: data.codebaseId,
    query: query,
    limit: 5,
    fuzzy_search: true
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'long-tail search status is 200': (r) => r.status === 200,
    'long-tail search response time < 300ms': (r) => r.timings.duration < 300,
  });

  if (success) {
    const body = JSON.parse(response.body);
    searchResultsCount.add(body.data.results.length);
  }

  searchErrorRate.add(!success);
  searchLatency.add(response.timings.duration);
}

function testConcurrentSearches(data) {
  // Simulate concurrent search requests
  const queries = [
    'function',
    'class',
    'interface',
    'const',
    'type'
  ];

  const promises = queries.map(query =>
    http.asyncRequest('POST', `${API_BASE}/queries`, JSON.stringify({
      codebase_id: data.codebaseId,
      query: query,
      limit: 10
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  );

  // Note: This is a simplified simulation of concurrent requests
  // In practice, k6 handles concurrency at the VU level
  for (const query of queries.slice(0, 3)) { // Execute 3 concurrent searches
    testSimpleQueries({ codebaseId: data.codebaseId, query });
  }
}

export function teardown(data) {
  if (data.codebaseId) {
    console.log(`🧹 Cleaning up search test codebase: ${data.codebaseId}`);

    const response = http.del(`${API_BASE}/codebases/${data.codebaseId}`, null, {
      timeout: '10s',
    });

    if (response.status === 200 || response.status === 204) {
      console.log('✅ Search test codebase cleanup completed');
    } else {
      console.error('❌ Failed to cleanup search test codebase');
    }
  }
}

export function handleSummary(data) {
  console.log('\n🔍 Search Performance Test Summary:');
  console.log(`📊 Total searches: ${data.metrics.search_latency ? data.metrics.search_latency.count : 0}`);
  console.log(`⚡ Average search latency: ${data.metrics.search_latency ? data.metrics.search_latency.avg.toFixed(2) : 'N/A'}ms`);
  console.log(`🎯 95th percentile: ${data.metrics.search_latency ? data.metrics.search_latency['p(95)'].toFixed(2) : 'N/A'}ms`);
  console.log(`📈 Average results per search: ${data.metrics.search_results_count ? data.metrics.search_results_count.avg.toFixed(1) : 'N/A'}`);
  console.log(`🎪 Average relevance score: ${data.metrics.search_relevance_score ? data.metrics.search_relevance_score.avg.toFixed(2) : 'N/A'}`);
  console.log(`❌ Search error rate: ${data.metrics.search_errors ? (data.metrics.search_errors.rate * 100).toFixed(2) : 'N/A'}%`);
}