/**
 * Indexing Performance Load Test (T085)
 *
 * Focused load test for indexing operations under various conditions.
 * Tests single file indexing, batch indexing, and concurrent indexing.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for indexing performance
export let indexingErrorRate = new Rate('indexing_errors');
export let indexingLatency = new Trend('indexing_latency');
export let indexingThroughput = new Trend('indexing_throughput');
export let jobCompletionTime = new Trend('job_completion_time');
export let indexingMemoryUsage = new Trend('indexing_memory_usage');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 5 },    // Warm up with low concurrency
    { duration: '3m', target: 20 },   // Normal indexing load
    { duration: '2m', target: 50 },   // High indexing load
    { duration: '3m', target: 20 },   // Return to normal
    { duration: '1m', target: 0 },    // Cool down
  ],

  thresholds: {
    indexing_errors: ['rate<0.1'], // Allow higher error rate for indexing
    indexing_latency: ['p(95)<3000', 'p(99)<10000'], // Indexing takes longer
    job_completion_time: ['p(95)<15000'], // Jobs should complete within 15s
    http_req_duration: ['p(95)<5000'],
  },

  discardResponseBodies: false,
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const API_BASE = `${BASE_URL}/api/v1`;

// Sample code generators
function generateTypeScriptCode(complexity = 'medium') {
  const functions = [
    'authenticateUser',
    'processPayment',
    'validateEmail',
    'calculateTotal',
    'renderComponent',
    'fetchData',
    'updateProfile',
    'sendNotification'
  ];

  const classes = [
    'UserService',
    'PaymentProcessor',
    'EmailValidator',
    'Calculator',
    'ComponentRenderer',
    'DataFetcher',
    'ProfileManager',
    'NotificationService'
  ];

  const interfaces = [
    'IUser',
    'IPayment',
    'IEmail',
    'ICalculator',
    'IComponent',
    'IDataFetcher',
    'IProfile',
    'INotification'
  ];

  let code = '';

  switch (complexity) {
    case 'simple':
      code = `
export function ${functions[Math.floor(Math.random() * functions.length)]}(): boolean {
  return true;
}
`;
      break;

    case 'medium':
      code = `
export class ${classes[Math.floor(Math.random() * classes.length)]} {
  private data: Map<string, any> = new Map();

  constructor(private config: any) {}

  async process(input: string): Promise<string> {
    const startTime = Date.now();
    let result = input.trim().toLowerCase();

    if (this.config.enableCache) {
      const cached = this.data.get(result);
      if (cached) return cached;
    }

    // Simulate processing
    result = result.replace(/\\s+/g, ' ');

    if (this.config.enableCache) {
      this.data.set(result, result);
    }

    console.log(\`Processing took \${Date.now() - startTime}ms\`);
    return result;
  }

  clearCache(): void {
    this.data.clear();
  }

  getStats(): { cacheSize: number; config: any } {
    return {
      cacheSize: this.data.size,
      config: this.config
    };
  }
}
`;
      break;

    case 'complex':
      code = `
import { EventEmitter } from 'events';

export interface ${interfaces[Math.floor(Math.random() * interfaces.length)]} {
  id: string;
  name: string;
  version: string;
  process(input: any): Promise<any>;
  validate(): boolean;
  serialize(): string;
}

export class ${classes[Math.floor(Math.random() * classes.length)]} extends EventEmitter implements ${interfaces[Math.floor(Math.random() * interfaces.length)]} {
  public readonly id: string;
  public readonly name: string;
  public readonly version: string = '1.0.0';

  private state: Map<string, any> = new Map();
  private metrics: Map<string, number> = new Map();
  private dependencies: string[] = [];

  constructor(name: string, private config: {
    maxRetries?: number;
    timeout?: number;
    enableMetrics?: boolean;
    dependencies?: string[];
  } = {}) {
    super();
    this.id = Math.random().toString(36).substr(2, 9);
    this.name = name;
    this.dependencies = config.dependencies || [];

    if (config.enableMetrics) {
      this.setupMetrics();
    }
  }

  private setupMetrics(): void {
    this.metrics.set('processCount', 0);
    this.metrics.set('errorCount', 0);
    this.metrics.set('avgProcessingTime', 0);
  }

  async process(input: any): Promise<any> {
    const startTime = Date.now();
    let attempts = 0;
    const maxRetries = this.config.maxRetries || 3;
    const timeout = this.config.timeout || 5000;

    try {
      while (attempts < maxRetries) {
        try {
          const result = await this.processInternal(input, timeout);

          if (this.config.enableMetrics) {
            this.updateMetrics(startTime, true);
          }

          this.emit('processed', { input, result, duration: Date.now() - startTime });
          return result;
        } catch (error) {
          attempts++;
          this.emit('retry', { attempt: attempts, error: error.message });

          if (attempts >= maxRetries) throw error;

          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
        }
      }

      throw new Error('Max retries exceeded');
    } catch (error) {
      if (this.config.enableMetrics) {
        this.updateMetrics(startTime, false);
      }

      this.emit('error', { input, error: error.message, duration: Date.now() - startTime });
      throw error;
    }
  }

  private async processInternal(input: any, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Processing timeout')), timeout);

      try {
        // Simulate complex processing
        const processed = {
          id: this.id,
          timestamp: Date.now(),
          input: this.sanitizeInput(input),
          output: this.transformInput(input),
          metadata: this.generateMetadata()
        };

        clearTimeout(timer);
        resolve(processed);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  private sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return input.trim().replace(/[<>]/g, '');
    }
    return input;
  }

  private transformInput(input: any): any {
    if (typeof input === 'string') {
      return input.toUpperCase().split(' ').join('_');
    }
    return JSON.stringify(input);
  }

  private generateMetadata(): any {
    return {
      processedAt: new Date().toISOString(),
      version: this.version,
      dependencies: this.dependencies,
      stateSize: this.state.size
    };
  }

  private updateMetrics(startTime: number, success: boolean): void {
    if (!this.config.enableMetrics) return;

    const duration = Date.now() - startTime;
    const processCount = this.metrics.get('processCount') || 0;
    const errorCount = this.metrics.get('errorCount') || 0;
    const avgTime = this.metrics.get('avgProcessingTime') || 0;

    this.metrics.set('processCount', processCount + 1);
    this.metrics.set(success ? 'errorCount' : 'processCount', errorCount + (success ? 0 : 1));

    // Calculate running average
    this.metrics.set('avgProcessingTime', (avgTime * processCount + duration) / (processCount + 1));
  }

  validate(): boolean {
    return this.id.length > 0 && this.name.length > 0 && this.version.length > 0;
  }

  serialize(): string {
    return JSON.stringify({
      id: this.id,
      name: this.name,
      version: this.version,
      state: Object.fromEntries(this.state),
      metrics: Object.fromEntries(this.metrics),
      dependencies: this.dependencies,
      config: this.config
    });
  }

  getMetrics(): any {
    return Object.fromEntries(this.metrics);
  }

  reset(): void {
    this.state.clear();
    this.metrics.clear();
    this.removeAllListeners();
  }
}
`;
      break;

    default:
      code = 'export const DEFAULT_VALUE = "test";';
  }

  return code;
}

function generateMultipleFiles(count = 5, complexity = 'medium') {
  const files = [];
  const modules = ['auth', 'utils', 'services', 'components', 'types', 'config', 'helpers', 'middleware'];

  for (let i = 0; i < count; i++) {
    const module = modules[Math.floor(Math.random() * modules.length)];
    const filename = `${module}/${Math.random().toString(36).substr(2, 9)}.ts`;

    files.push({
      path: filename,
      content: generateTypeScriptCode(complexity)
    });
  }

  return files;
}

let testCodebaseId;

export function setup() {
  console.log('📁 Setting up Indexing Performance Test');

  const createResponse = http.post(`${API_BASE}/codebases`, JSON.stringify({
    name: 'indexing-performance-test',
    path: '/tmp/indexing-test',
    language: 'typescript'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (createResponse.status !== 201) {
    throw new Error('Failed to create test codebase');
  }

  testCodebaseId = JSON.parse(createResponse.body).data.id;
  console.log(`✅ Created test codebase: ${testCodebaseId}`);

  return { codebaseId: testCodebaseId };
}

export default function(data) {
  const scenarios = [
    testSingleFileIndexing,
    testBatchIndexing,
    testComplexFileIndexing,
    testConcurrentIndexing,
    testLargeFileIndexing
  ];

  const selectedScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  selectedScenario(data);

  sleep(Math.random() * 2 + 1); // 1-3 seconds between indexing operations
}

function testSingleFileIndexing(data) {
  const file = {
    path: `test-${Math.random().toString(36).substr(2, 9)}.ts`,
    content: generateTypeScriptCode('simple')
  };

  const startTime = Date.now();

  const response = http.post(`${API_BASE}/codebases/${data.codebaseId}/index`, JSON.stringify({
    files: [file],
    force_reindex: false
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'single file indexing status is 200/202': (r) => r.status === 200 || r.status === 202,
    'single file indexing response time < 2s': (r) => r.timings.duration < 2000,
    'single file indexing has job ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data.job_id;
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    const body = JSON.parse(response.body);

    // Monitor job completion if async
    if (response.status === 202 && body.data.job_id) {
      monitorJobCompletion(body.data.job_id, startTime);
    }

    indexingThroughput.add(file.content.length / (response.timings.duration / 1000)); // KB/s
  }

  indexingErrorRate.add(!success);
  indexingLatency.add(response.timings.duration);
}

function testBatchIndexing(data) {
  const fileCount = Math.floor(Math.random() * 5) + 3; // 3-7 files
  const files = generateMultipleFiles(fileCount, 'medium');
  const totalSize = files.reduce((sum, file) => sum + file.content.length, 0);

  const startTime = Date.now();

  const response = http.post(`${API_BASE}/codebases/${data.codebaseId}/index`, JSON.stringify({
    files: files,
    force_reindex: false
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'batch indexing status is 200/202': (r) => r.status === 200 || r.status === 202,
    'batch indexing response time < 5s': (r) => r.timings.duration < 5000,
    'batch indexing has job ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data.job_id;
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    const body = JSON.parse(response.body);

    if (response.status === 202 && body.data.job_id) {
      monitorJobCompletion(body.data.job_id, startTime);
    }

    indexingThroughput.add(totalSize / (response.timings.duration / 1000)); // KB/s
  }

  indexingErrorRate.add(!success);
  indexingLatency.add(response.timings.duration);
}

function testComplexFileIndexing(data) {
  const file = {
    path: `complex-${Math.random().toString(36).substr(2, 9)}.ts`,
    content: generateTypeScriptCode('complex')
  };

  const startTime = Date.now();

  const response = http.post(`${API_BASE}/codebases/${data.codebaseId}/index`, JSON.stringify({
    files: [file],
    force_reindex: false
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'complex file indexing status is 200/202': (r) => r.status === 200 || r.status === 202,
    'complex file indexing response time < 8s': (r) => r.timings.duration < 8000,
  });

  if (success) {
    const body = JSON.parse(response.body);

    if (response.status === 202 && body.data.job_id) {
      monitorJobCompletion(body.data.job_id, startTime);
    }

    indexingThroughput.add(file.content.length / (response.timings.duration / 1000)); // KB/s
  }

  indexingErrorRate.add(!success);
  indexingLatency.add(response.timings.duration);
}

function testConcurrentIndexing(data) {
  // Simulate concurrent indexing by firing multiple requests quickly
  const files = generateMultipleFiles(2, 'medium');

  for (const file of files) {
    const response = http.post(`${API_BASE}/codebases/${data.codebaseId}/index`, JSON.stringify({
      files: [file],
      force_reindex: false
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    const success = check(response, {
      'concurrent indexing status is 200/202': (r) => r.status === 200 || r.status === 202,
    });

    indexingErrorRate.add(!success);
    indexingLatency.add(response.timings.duration);
  }
}

function testLargeFileIndexing(data) {
  // Generate a large file by concatenating multiple complex code blocks
  let largeContent = '';
  for (let i = 0; i < 5; i++) {
    largeContent += generateTypeScriptCode('complex') + '\n\n';
  }

  const file = {
    path: `large-${Math.random().toString(36).substr(2, 9)}.ts`,
    content: largeContent
  };

  const startTime = Date.now();

  const response = http.post(`${API_BASE}/codebases/${data.codebaseId}/index`, JSON.stringify({
    files: [file],
    force_reindex: false
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(response, {
    'large file indexing status is 200/202': (r) => r.status === 200 || r.status === 202,
    'large file indexing response time < 15s': (r) => r.timings.duration < 15000,
  });

  if (success) {
    const body = JSON.parse(response.body);

    if (response.status === 202 && body.data.job_id) {
      monitorJobCompletion(body.data.job_id, startTime);
    }

    indexingThroughput.add(file.content.length / (response.timings.duration / 1000)); // KB/s
  }

  indexingErrorRate.add(!success);
  indexingLatency.add(response.timings.duration);
}

function monitorJobCompletion(jobId, startTime) {
  // Poll for job completion (simplified)
  let attempts = 0;
  const maxAttempts = 10;

  const checkJob = () => {
    attempts++;

    const jobResponse = http.get(`${API_BASE}/jobs/${jobId}`, {
      timeout: '5s',
    });

    if (jobResponse.status === 200) {
      try {
        const jobData = JSON.parse(jobResponse.body);

        if (jobData.data.status === 'completed') {
          const completionTime = Date.now() - startTime;
          jobCompletionTime.add(completionTime);
          return true;
        } else if (jobData.data.status === 'failed') {
          console.error(`❌ Job ${jobId} failed: ${jobData.data.error}`);
          return false;
        }
      } catch (e) {
        console.error(`❌ Failed to parse job response: ${e.message}`);
        return false;
      }
    }

    if (attempts < maxAttempts) {
      // Continue checking
      return false;
    } else {
      console.warn(`⚠️ Job ${jobId} did not complete within expected time`);
      return false;
    }
  };

  // Initial check
  checkJob();
}

export function teardown(data) {
  if (data.codebaseId) {
    console.log(`🧹 Cleaning up indexing test codebase: ${data.codebaseId}`);

    const response = http.del(`${API_BASE}/codebases/${data.codebaseId}`, null, {
      timeout: '10s',
    });

    if (response.status === 200 || response.status === 204) {
      console.log('✅ Indexing test codebase cleanup completed');
    } else {
      console.error('❌ Failed to cleanup indexing test codebase');
    }
  }
}

export function handleSummary(data) {
  console.log('\n📁 Indexing Performance Test Summary:');
  console.log(`📊 Total indexing operations: ${data.metrics.indexing_latency ? data.metrics.indexing_latency.count : 0}`);
  console.log(`⚡ Average indexing latency: ${data.metrics.indexing_latency ? data.metrics.indexing_latency.avg.toFixed(2) : 'N/A'}ms`);
  console.log(`🎯 95th percentile: ${data.metrics.indexing_latency ? data.metrics.indexing_latency['p(95)'].toFixed(2) : 'N/A'}ms`);
  console.log(`📈 Average throughput: ${data.metrics.indexing_throughput ? data.metrics.indexing_throughput.avg.toFixed(1) : 'N/A'} KB/s`);
  console.log(`⏱️  Average job completion time: ${data.metrics.job_completion_time ? data.metrics.job_completion_time.avg.toFixed(2) : 'N/A'}ms`);
  console.log(`❌ Indexing error rate: ${data.metrics.indexing_errors ? (data.metrics.indexing_errors.rate * 100).toFixed(2) : 'N/A'}%`);
}