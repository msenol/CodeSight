# CodeSight MCP Load Testing Suite (T085)

Comprehensive load testing suite for the CodeSight MCP Server using k6. This suite tests performance under various conditions and provides detailed metrics for analysis.

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- k6 installed locally or Docker
- CodeSight MCP Server running on `http://localhost:4000`

### Installation

```bash
# Install k6 (macOS)
brew install k6

# Install k6 (Ubuntu/Debian)
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Install k6 (Windows)
# Download from https://dl.k6.io/msi/k6-latest-amd64.msi

# Or use Docker
docker pull loadimpact/k6
```

### Running Tests

```bash
# Run general load test
k6 run k6.config.js

# Run search-specific performance test
k6 run search_performance.js

# Run indexing-specific performance test
k6 run indexing_performance.js

# Run with custom configuration
k6 run --vus 50 --duration 5m k6.config.js

# Run with environment variables
BASE_URL=http://localhost:4000 k6 run k6.config.js

# Run with Docker
docker run -i --rm -v $(pwd):/scripts loadimpact/k6 run /scripts/k6.config.js
```

## 📊 Test Scenarios

### 1. General Load Test (`k6.config.js`)

**Purpose**: Overall system performance under mixed load

**Stages**:
- Warm up: 10 users for 2 minutes
- Load test: 50 users for 5 minutes
- Stress test: 100 users for 2 minutes
- Sustained load: 100 users for 5 minutes
- Peak stress: 200 users for 2 minutes
- Cool down: Ramp down to 0 users

**Metrics Tracked**:
- Overall error rate
- Search response times
- Indexing response times
- API response times
- Request throughput

### 2. Search Performance Test (`search_performance.js`)

**Purpose**: Focused testing of search functionality

**Query Types**:
- Simple queries (single keywords)
- Complex queries (multi-word, filters)
- Filtered queries (entity type specific)
- Long-tail queries (rare combinations)
- Concurrent searches

**Performance Targets**:
- Simple queries: < 100ms (95th percentile)
- Complex queries: < 200ms (95th percentile)
- Long-tail queries: < 300ms (95th percentile)
- Error rate: < 5%

### 3. Indexing Performance Test (`indexing_performance.js`)

**Purpose**: Performance testing of code indexing operations

**File Types**:
- Simple files (basic functions/classes)
- Medium complexity files (multiple methods)
- Complex files (large classes with dependencies)
- Large files (5000+ lines)
- Batch operations (multiple files)

**Performance Targets**:
- Simple files: < 2s
- Medium files: < 5s
- Complex files: < 8s
- Large files: < 15s
- Batch operations: < 10s per 100KB

## 📈 Performance Metrics

### Built-in k6 Metrics

- `http_reqs`: Total HTTP requests
- `http_req_failed`: Failed HTTP requests
- `http_req_duration`: Request duration
- `http_req_waiting`: Time waiting for response
- `http_req_connecting`: Time connecting to server
- `vus`: Active virtual users
- `vus_max`: Maximum virtual users

### Custom Metrics

#### Search Metrics
- `search_errors`: Search operation error rate
- `search_latency`: Search response times
- `search_results_count`: Number of results per search
- `search_relevance_score`: Average relevance scores

#### Indexing Metrics
- `indexing_errors`: Indexing operation error rate
- `indexing_latency`: Indexing response times
- `indexing_throughput`: Data processing rate (KB/s)
- `job_completion_time`: Background job completion times
- `indexing_memory_usage`: Memory consumption during indexing

## 🎯 Performance Thresholds

### Service Level Objectives (SLOs)

| Metric | Target | Description |
|--------|--------|-------------|
| Overall Error Rate | < 5% | Total failed requests |
| Search Response Time | P95 < 200ms | Search query performance |
| API Response Time | P95 < 300ms | General API calls |
| Indexing Response Time | P95 < 5s | Code indexing operations |
| Concurrent Users | 100 | Supported simultaneous users |
| Request Throughput | 100 req/s | Maximum request rate |

### Performance Alerts

- **Critical**: Error rate > 10% or P99 response time > 2s
- **Warning**: Error rate > 5% or P95 response time > 500ms
- **Info**: Error rate > 2% or P90 response time > 300ms

## 🔧 Configuration

### Environment Variables

```bash
# Target server URL
export BASE_URL=http://localhost:4000

# Test configuration
export TEST_DURATION=10m
export MAX_VUS=100
export WARMUP_DURATION=2m

# Authentication (if required)
export API_TOKEN=your-api-token
export AUTH_HEADER=Bearer
```

### k6 Configuration

The `options` object in each test file can be customized:

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<500'],
  },
  discardResponseBodies: true,
};
```

## 📋 Test Data

### Generated Content

The load tests generate realistic code samples:

```typescript
// Simple function
export function authenticateUser(): boolean {
  return true;
}

// Medium complexity class
export class UserService {
  private data: Map<string, any> = new Map();

  async process(input: string): Promise<string> {
    return input.toUpperCase();
  }
}

// Complex file with interfaces and implementations
export interface IUser {
  id: string;
  name: string;
}

export class UserService implements IUser {
  // Complex implementation with error handling, metrics, etc.
}
```

### Query Variations

Test queries cover different patterns:

- Single keywords: `function`, `class`, `interface`
- Multi-word: `function authentication`, `class UserService`
- Type-specific: `function`, `class`, `interface`, `variable`
- Long-tail: `authentication middleware`, `database connection pool`

## 📊 Results Analysis

### Console Output

k6 provides real-time metrics during test execution:

```
     iteration: 501   [####################] 100%
     ✓ search query status is 200
     ✓ search response time < 200ms
     ✓ search response has results

     ✓ checks.........................: 100.00% ✓ 501   ✗ 0
     ✓ data_received..................: 0.2 MB MB
     ✓ data_sent......................: 0.1 MB MB
     ✓ http_req_duration..............: avg=45.2ms min=15.1ms med=38.7ms max=234.5ms p(90)=67.3ms p(95)=89.7ms p(99.9)=156.2ms
```

### HTML Reports

Generate detailed HTML reports:

```bash
# Save results to JSON
k6 run --out json=results.json k6.config.js

# Generate HTML report (requires k6-reporter)
npm install -g k6-reporter
k6-reporter results.json

# Or use the built-in HTML output
k6 run --out html=report.html k6.config.js
```

### Performance Analysis

Key areas to analyze:

1. **Response Time Trends**: Monitor for performance degradation
2. **Error Patterns**: Identify specific failure scenarios
3. **Throughput Limits**: Find maximum sustainable load
4. **Resource Utilization**: Monitor server CPU/memory usage
5. **Scalability**: How performance scales with user count

## 🚨 Troubleshooting

### Common Issues

**Connection Refused**
```bash
# Ensure server is running
curl http://localhost:4000/health

# Check port configuration
export BASE_URL=http://localhost:3000
```

**High Error Rates**
```bash
# Reduce concurrent users
k6 run --vus 10 k6.config.js

# Increase timeout thresholds
export TEST_TIMEOUT=60s
```

**Memory Issues**
```bash
# Reduce test data size
export MAX_FILE_SIZE=1000

# Monitor server resources
top -p $(pgrep node)
```

### Debug Mode

Enable detailed logging:

```bash
# k6 debug mode
k6 run --http-debug k6.config.js

# Verbose output
k6 run -v k6.config.js

# Enable request/response logging
export K6_LOG_LEVEL=debug
```

## 🔄 Continuous Integration

### GitHub Actions

```yaml
name: Load Tests
on: [push, pull_request]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Start CodeSight Server
        run: npm run start &

      - name: Wait for server
        run: curl --retry 10 --retry-delay 5 http://localhost:4000/health

      - name: Run load tests
        run: k6 run --out json=results.json tests/load/k6.config.js

      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: load-test-results
          path: results.json
```

### Performance Monitoring

Integrate with monitoring tools:

```bash
# InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 k6.config.js

# Prometheus output
k6 run --out prometheus=localhost:9090 k6.config.js

# Cloud output (k6 Cloud)
k6 cloud --token $K6_CLOUD_TOKEN k6.config.js
```

## 📚 Best Practices

1. **Test Regularly**: Run load tests in CI/CD pipeline
2. **Monitor Baselines**: Track performance over time
3. **Test Realistic Scenarios**: Use production-like data and queries
4. **Gradual Load Increase**: Use stage-based testing approach
5. **Monitor Resources**: Track server CPU, memory, and disk usage
6. **Document Results**: Keep historical performance data
7. **Set Alerts**: Configure notifications for performance degradation

## 🎯 Performance Optimization

Based on load test results, consider these optimizations:

### Database Optimization
- Add indexes for common search patterns
- Implement query result caching
- Optimize database connection pooling

### Application Optimization
- Implement request-level caching
- Optimize parsing algorithms
- Add request batching capabilities

### Infrastructure Scaling
- Horizontal scaling with load balancers
- CDN for static assets
- Auto-scaling based on metrics

---

**For questions or issues**, please refer to the [k6 documentation](https://k6.io/docs/) or create an issue in the project repository.