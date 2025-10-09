# Advanced API Usage Examples

This guide covers advanced patterns, optimization techniques, and complex use cases for the CodeSight MCP Server API.

## Advanced Search Patterns

### Multi-Language Search
Search across different programming languages in a single query:

```bash
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "database connection handling with retry logic",
    "codebase_id": "your-codebase-id",
    "limit": 15,
    "filters": {
      "file_types": ["ts", "js", "py", "go", "rs", "java"],
      "entity_types": ["function", "method", "class"],
      "min_line_count": 10
    }
  }'
```

### Semantic Search with Context
Use context-aware search for better results:

```bash
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "error handling in microservices architecture with circuit breaker pattern",
    "codebase_id": "your-codebase-id",
    "limit": 20,
    "filters": {
      "file_types": ["ts", "js", "py"],
      "context_keywords": ["circuit breaker", "retry", "fallback", "timeout"]
    },
    "include_content": true,
    "expand_snippets": true
  }'
```

### Composite Queries
Combine multiple search criteria:

```bash
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "REST API endpoint with authentication middleware",
    "codebase_id": "your-codebase-id",
    "limit": 25,
    "filters": {
      "file_types": ["ts", "js"],
      "entity_types": ["function", "method"],
      "visibility": ["public"],
      "has_annotations": true,
      "min_line_count": 15,
      "max_line_count": 100
    },
    "sort_by": "relevance",
    "boost_recent": true
  }'
```

## Advanced MCP Tool Usage

### Chain Analysis Workflow
Perform a comprehensive analysis workflow:

```bash
# Step 1: Find all API endpoints
echo "Step 1: Discovering API endpoints..."
ENDPOINTS_RESPONSE=$(curl -s -X POST http://localhost:4000/api/tools/get_api_endpoints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "codebase_id": "your-codebase-id",
    "include_methods": ["GET", "POST", "PUT", "DELETE"],
    "include_documentation": true
  }')

echo "Found $(echo $ENDPOINTS_RESPONSE | jq '.result.total_count') endpoints"

# Step 2: Find authentication-related code
echo "Step 2: Finding authentication code..."
AUTH_RESPONSE=$(curl -s -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "authentication middleware JWT token validation",
    "codebase_id": "your-codebase-id",
    "limit": 10,
    "filters": {
      "file_types": ["ts", "js"],
      "entity_types": ["function", "method", "class"]
    }
  }')

# Step 3: Analyze security for authentication files
echo "Step 3: Analyzing security..."
for file_path in $(echo $AUTH_RESPONSE | jq -r '.results[].file_path' | sort | uniq); do
  echo "Analyzing: $file_path"
  curl -X POST http://localhost:4000/api/tools/analyze_security \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -d "{
      \"file_path\": \"$file_path\",
      \"codebase_id\": \"your-codebase-id\",
      \"analysis_level\": \"comprehensive\"
    }" | jq '.result.vulnerabilities[]'
done

# Step 4: Check complexity
echo "Step 4: Checking complexity..."
for file_path in $(echo $AUTH_RESPONSE | jq -r '.results[].file_path' | sort | uniq); do
  echo "Complexity analysis for: $file_path"
  curl -X POST http://localhost:4000/api/tools/check_complexity \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -d "{
      \"file_path\": \"$file_path\",
      \"codebase_id\": \"your-codebase-id\",
      \"include_suggestions\": true
    }" | jq '.result'
done
```

### Data Flow Analysis
Trace data flow through your application:

```bash
# Find database models
curl -X POST http://localhost:4000/api/queries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "database model schema definition",
    "codebase_id": "your-codebase-id",
    "limit": 10,
    "filters": {
      "entity_types": ["class", "interface", "type"]
    }
  }'

# Trace data flow for a specific entity
curl -X POST http://localhost:4000/api/tools/trace_data_flow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "entity_name": "User",
    "codebase_id": "your-codebase-id",
    "max_depth": 5,
    "include_types": ["function_calls", "property_access", "inheritance"]
  }'
```

### Comprehensive Security Audit
Automated security audit script:

```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:4000"
AUTH_TOKEN="YOUR_JWT_TOKEN"
CODEBASE_ID="your-codebase-id"

# Function to make API calls
call_api() {
  local endpoint=$1
  local data=$2
  curl -s -X POST "$BASE_URL$endpoint" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d "$data"
}

echo "🔒 Starting comprehensive security audit..."

# 1. Find all files with authentication/authorization logic
echo "📋 Step 1: Finding authentication-related files..."
AUTH_FILES=$(call_api "/api/queries" '{
  "query": "authentication authorization login password security",
  "codebase_id": "'$CODEBASE_ID'",
  "limit": 50,
  "filters": {
    "file_types": ["ts", "js", "py", "go", "java"]
  }
}')

echo "Found $(echo $AUTH_FILES | jq '.results | length') authentication-related files"

# 2. Find database operations
echo "📋 Step 2: Finding database operation files..."
DB_FILES=$(call_api "/api/queries" '{
  "query": "database query SQL ORM connection transaction",
  "codebase_id": "'$CODEBASE_ID'",
  "limit": 50,
  "filters": {
    "file_types": ["ts", "js", "py", "go", "java"]
  }
}')

echo "Found $(echo $DB_FILES | jq '.results | length') database-related files"

# 3. Find API endpoints
echo "📋 Step 3: Discovering API endpoints..."
API_ENDPOINTS=$(call_api "/api/tools/get_api_endpoints" '{
  "codebase_id": "'$CODEBASE_ID'",
  "include_methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],
  "include_documentation": true
}')

echo "Found $(echo $API_ENDPOINTS | jq '.result.total_count') API endpoints"

# 4. Analyze security for each category
echo "🔍 Step 4: Analyzing security vulnerabilities..."

# Analyze authentication files
echo "   Analyzing authentication files..."
for file_path in $(echo $AUTH_FILES | jq -r '.results[].file_path' | sort | uniq); do
  echo "    🔍 Analyzing: $file_path"
  security_result=$(call_api "/api/tools/analyze_security" "{
    \"file_path\": \"$file_path\",
    \"codebase_id\": \"$CODEBASE_ID\",
    \"analysis_level\": \"comprehensive\"
  }")

  vulnerability_count=$(echo $security_result | jq '.result.vulnerabilities | length')
  if [ "$vulnerability_count" -gt 0 ]; then
    echo "      ⚠️  Found $vulnerability_count vulnerabilities"
    echo $security_result | jq '.result.vulnerabilities[] | {severity, type, description}'
  fi
done

# Analyze database files
echo "   Analyzing database files..."
for file_path in $(echo $DB_FILES | jq -r '.results[].file_path' | sort | uniq); do
  echo "    🔍 Analyzing: $file_path"
  security_result=$(call_api "/api/tools/analyze_security" "{
    \"file_path\": \"$file_path\",
    \"codebase_id\": \"$CODEBASE_ID\",
    \"analysis_level\": \"comprehensive\"
  }")

  vulnerability_count=$(echo $security_result | jq '.result.vulnerabilities | length')
  if [ "$vulnerability_count" -gt 0 ]; then
    echo "      ⚠️  Found $vulnerability_count vulnerabilities"
    echo $security_result | jq '.result.vulnerabilities[] | {severity, type, description}'
  fi
done

# 5. Check for duplicate code (potential security risk)
echo "📋 Step 5: Checking for duplicate code..."
DUPLICATES=$(call_api "/api/tools/find_duplicates" '{
  "codebase_id": "'$CODEBASE_ID'",
  "similarity_threshold": 0.85,
  "include_suggestions": true
}')

duplicate_count=$(echo $DUPLICATES | jq '.result.duplicates | length')
if [ "$duplicate_count" -gt 0 ]; then
  echo "   ⚠️  Found $duplicate_count duplicate code blocks"
  echo $DUPLICATES | jq '.result.duplicates[] | {similarity, files, suggestion}'
fi

echo "✅ Security audit completed!"
```

## Performance Optimization

### Batching and Parallel Processing
Process multiple searches efficiently:

```javascript
const axios = require('axios');
const pLimit = require('p-limit');

class OptimizedCodeSightClient {
  constructor(baseURL, authToken) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    this.concurrencyLimit = pLimit(5); // Limit concurrent requests
  }

  async batchSearch(queries, codebaseId) {
    const searchPromises = queries.map(query =>
      this.concurrencyLimit(() => this.searchCode(query, codebaseId))
    );

    return Promise.allSettled(searchPromises);
  }

  async searchCode(query, options = {}) {
    try {
      const response = await this.client.post('/api/queries', {
        query,
        codebase_id: options.codebaseId,
        limit: options.limit || 10,
        filters: options.filters || {}
      });
      return { success: true, data: response.data, query };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        query
      };
    }
  }

  async comprehensiveAnalysis(codebaseId) {
    // Batch multiple searches
    const queries = [
      'authentication security login',
      'database connection transaction',
      'API endpoint route handler',
      'error handling exception',
      'logging monitoring metrics'
    ];

    console.log('Starting batch search...');
    const results = await this.batchSearch(queries, codebaseId);

    // Process successful results
    const successfulResults = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const allFiles = new Set();

    successfulResults.forEach(result => {
      result.value.data.results.forEach(item => {
        allFiles.add(item.file_path);
      });
    });

    console.log(`Found ${allFiles.size} unique files to analyze`);

    // Batch analysis
    const analysisPromises = Array.from(allFiles).map(filePath =>
      this.concurrencyLimit(() => this.analyzeFile(filePath, codebaseId))
    );

    const analyses = await Promise.allSettled(analysisPromises);

    return {
      searchResults: successfulResults.map(r => r.value),
      fileAnalyses: analyses.filter(a => a.status === 'fulfilled').map(a => a.value)
    };
  }

  async analyzeFile(filePath, codebaseId) {
    const [security, complexity] = await Promise.allSettled([
      this.client.post('/api/tools/analyze_security', {
        file_path: filePath,
        codebase_id: codebaseId,
        analysis_level: 'standard'
      }),
      this.client.post('/api/tools/check_complexity', {
        file_path: filePath,
        codebase_id: codebaseId,
        include_suggestions: true
      })
    ]);

    return {
      filePath,
      security: security.status === 'fulfilled' ? security.value.data : null,
      complexity: complexity.status === 'fulfilled' ? complexity.value.data : null
    };
  }
}

// Usage
const client = new OptimizedCodeSightClient('http://localhost:4000', 'your-jwt-token');

client.comprehensiveAnalysis('your-codebase-id')
  .then(results => {
    console.log(`Analyzed ${results.fileAnalyses.length} files`);

    // Generate summary report
    const vulnerabilities = results.fileAnalyses
      .filter(f => f.security && f.security.result.vulnerabilities.length > 0)
      .length;

    const highComplexity = results.fileAnalyses
      .filter(f => f.complexity && f.complexity.result.complexity_score > 10)
      .length;

    console.log(`Files with vulnerabilities: ${vulnerabilities}`);
    console.log(`Files with high complexity: ${highComplexity}`);
  })
  .catch(console.error);
```

### Caching Strategy
Implement intelligent caching:

```python
import requests
import json
import hashlib
import time
from functools import lru_cache
from typing import Dict, List, Optional

class CachedCodeSightClient:
    def __init__(self, base_url: str, auth_token: str, cache_ttl: int = 300):
        self.base_url = base_url
        self.auth_token = auth_token
        self.cache_ttl = cache_ttl
        self.cache = {}
        self.headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        }

    def _cache_key(self, endpoint: str, data: Dict) -> str:
        """Generate cache key from endpoint and request data"""
        cache_data = f"{endpoint}:{json.dumps(data, sort_keys=True)}"
        return hashlib.md5(cache_data.encode()).hexdigest()

    def _is_cache_valid(self, timestamp: float) -> bool:
        """Check if cached data is still valid"""
        return time.time() - timestamp < self.cache_ttl

    def _get_from_cache(self, cache_key: str) -> Optional[Dict]:
        """Get data from cache if valid"""
        if cache_key in self.cache:
            data, timestamp = self.cache[cache_key]
            if self._is_cache_valid(timestamp):
                return data
            else:
                del self.cache[cache_key]
        return None

    def _store_in_cache(self, cache_key: str, data: Dict):
        """Store data in cache with timestamp"""
        self.cache[cache_key] = (data, time.time())

    def _make_request(self, endpoint: str, data: Dict) -> Dict:
        """Make API request with caching"""
        cache_key = self._cache_key(endpoint, data)

        # Try cache first
        cached_result = self._get_from_cache(cache_key)
        if cached_result:
            print(f"🎯 Cache hit for {endpoint}")
            return cached_result

        # Make API request
        print(f"🌐 API call to {endpoint}")
        response = requests.post(
            f"{self.base_url}{endpoint}",
            headers=self.headers,
            json=data
        )
        response.raise_for_status()
        result = response.json()

        # Cache successful results
        if result.get('success'):
            self._store_in_cache(cache_key, result)

        return result

    def search_code(self, query: str, codebase_id: str, **kwargs) -> Dict:
        """Search code with caching"""
        data = {
            'query': query,
            'codebase_id': codebase_id,
            **kwargs
        }
        return self._make_request('/api/queries', data)

    def analyze_security(self, file_path: str, codebase_id: str, **kwargs) -> Dict:
        """Analyze security with caching"""
        data = {
            'file_path': file_path,
            'codebase_id': codebase_id,
            **kwargs
        }
        return self._make_request('/api/tools/analyze_security', data)

    def get_comprehensive_analysis(self, codebase_id: str) -> Dict:
        """Get comprehensive analysis with optimized caching"""
        # Step 1: Get all files (cached)
        search_result = self.search_code(
            "function class method",
            codebase_id,
            limit=100
        )

        if not search_result.get('success'):
            return search_result

        # Get unique files
        files = set()
        for result in search_result['results']:
            files.add(result['file_path'])

        print(f"Analyzing {len(files)} unique files...")

        # Step 2: Batch analyze files (with caching)
        analyses = []
        for file_path in files:
            try:
                security_result = self.analyze_security(
                    file_path,
                    codebase_id,
                    analysis_level='standard'
                )
                analyses.append({
                    'file_path': file_path,
                    'security': security_result
                })
            except Exception as e:
                print(f"Failed to analyze {file_path}: {e}")

        return {
            'success': True,
            'total_files': len(files),
            'analyzed_files': len(analyses),
            'analyses': analyses
        }

# Usage
client = CachedCodeSightClient(
    'http://localhost:4000',
    'your-jwt-token',
    cache_ttl=600  # 10 minutes
)

# First call will hit API
print("First analysis...")
result1 = client.get_comprehensive_analysis('your-codebase-id')

# Second call will use cache
print("\nSecond analysis (should use cache)...")
result2 = client.get_comprehensive_analysis('your-codebase-id')
```

## Monitoring and Metrics

### Performance Monitoring Script
```bash
#!/bin/bash

# Performance monitoring for CodeSight MCP Server
BASE_URL="http://localhost:4000"
AUTH_TOKEN="YOUR_JWT_TOKEN"
CODEBASE_ID="your-codebase-id"

# Function to measure response time
measure_time() {
  local start_time=$(date +%s%N)
  local response=$(curl -s -w "%{http_code}" -o /tmp/response.json "$@")
  local end_time=$(date +%s%N)
  local duration=$(((end_time - start_time) / 1000000)) # Convert to milliseconds

  echo "$duration"
}

# Function to run performance test
run_performance_test() {
  local test_name=$1
  local endpoint=$2
  local data=$3

  echo "🔧 Testing: $test_name"

  total_time=0
  successful_requests=0
  failed_requests=0

  for i in {1..10}; do
    echo -n "  Request $i... "

    response_time=$(measure_time \
      -X POST "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -d "$data")

    http_code=$(tail -c 3 /tmp/response.json)

    if [ "$http_code" = "200" ]; then
      echo "✅ ${response_time}ms"
      total_time=$((total_time + response_time))
      successful_requests=$((successful_requests + 1))
    else
      echo "❌ HTTP $http_code"
      failed_requests=$((failed_requests + 1))
    fi
  done

  if [ $successful_requests -gt 0 ]; then
    avg_time=$((total_time / successful_requests))
    echo "  📊 Average response time: ${avg_time}ms"
    echo "  ✅ Success rate: $successful_requests/10"
  else
    echo "  ❌ All requests failed"
  fi
  echo
}

echo "🚀 Starting performance tests..."
echo

# Test 1: Basic search
run_performance_test "Basic Search" "/api/queries" '{
  "query": "authentication function",
  "codebase_id": "'$CODEBASE_ID'",
  "limit": 10
}'

# Test 2: Complex search with filters
run_performance_test "Complex Search" "/api/queries" '{
  "query": "REST API endpoint with authentication middleware",
  "codebase_id": "'$CODEBASE_ID'",
  "limit": 20,
  "filters": {
    "file_types": ["ts", "js"],
    "entity_types": ["function", "method"],
    "min_line_count": 10
  }
}'

# Test 3: Security analysis
run_performance_test "Security Analysis" "/api/tools/analyze_security" '{
  "file_path": "src/auth/auth.service.ts",
  "codebase_id": "'$CODEBASE_ID'",
  "analysis_level": "comprehensive"
}'

# Test 4: Complexity check
run_performance_test "Complexity Check" "/api/tools/check_complexity" '{
  "file_path": "src/services/user.service.ts",
  "codebase_id": "'$CODEBASE_ID'",
  "include_suggestions": true
}'

# Test 5: Function explanation
run_performance_test "Function Explanation" "/api/tools/explain_function" '{
  "function_identifier": "authenticateUser",
  "codebase_id": "'$CODEBASE_ID'",
  "detail_level": "comprehensive"
}'

# Test 6: Health check
run_performance_test "Health Check" "/health" ""

# Get server metrics
echo "📈 Server Metrics:"
curl -s "$BASE_URL/metrics" | grep -E "(http_request_duration|search_operation|memory_usage)"

echo "✅ Performance tests completed!"
```

### Real-time Monitoring Dashboard
```javascript
// Simple monitoring dashboard using Node.js and WebSockets
const WebSocket = require('ws');
const axios = require('axios');
const express = require('express');

class MonitoringDashboard {
  constructor(apiURL, authToken) {
    this.apiURL = apiURL;
    this.authToken = authToken;
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      lastUpdate: Date.now()
    };
    this.setupWebSocket();
  }

  setupWebSocket() {
    const wss = new WebSocket.Server({ port: 8080 });

    wss.on('connection', (ws) => {
      console.log('📊 Dashboard client connected');

      // Send initial data
      ws.send(JSON.stringify({
        type: 'initial',
        data: this.metrics
      }));

      // Send periodic updates
      const interval = setInterval(async () => {
        try {
          const metrics = await this.collectMetrics();
          ws.send(JSON.stringify({
            type: 'update',
            data: metrics
          }));
        } catch (error) {
          console.error('Failed to collect metrics:', error);
        }
      }, 5000); // Update every 5 seconds

      ws.on('close', () => {
        console.log('📊 Dashboard client disconnected');
        clearInterval(interval);
      });
    });

    console.log('📊 Monitoring dashboard running on ws://localhost:8080');
  }

  async collectMetrics() {
    try {
      // Get Prometheus metrics
      const metricsResponse = await axios.get(`${this.apiURL}/metrics`);
      const metricsText = metricsResponse.data;

      // Parse relevant metrics
      const requestDuration = this.parseMetric(metricsText, 'http_request_duration_ms');
      const searchOperations = this.parseMetric(metricsText, 'search_operations_total');
      const errorRate = this.parseMetric(metricsText, 'http_requests_errors_total');

      // Simulate some requests to get response times
      const responseTime = await this.measureResponseTime();

      this.metrics.requests += 1;
      this.metrics.responseTime.push(responseTime);

      // Keep only last 100 response times
      if (this.metrics.responseTime.length > 100) {
        this.metrics.responseTime = this.metrics.responseTime.slice(-100);
      }

      return {
        ...this.metrics,
        avgResponseTime: this.calculateAverage(this.metrics.responseTime),
        requestDuration,
        searchOperations,
        errorRate,
        timestamp: Date.now()
      };
    } catch (error) {
      this.metrics.errors += 1;
      throw error;
    }
  }

  parseMetric(metricsText, metricName) {
    const regex = new RegExp(`${metricName}{.*?}\\s+(\\d+(\\.\\d+)?)`, 'g');
    const matches = metricsText.match(regex);
    return matches ? matches.map(m => parseFloat(m.split(/\s+/)[1])) : [];
  }

  calculateAverage(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  async measureResponseTime() {
    const start = Date.now();
    try {
      await axios.get(`${this.apiURL}/health`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
      return Date.now() - start;
    } catch (error) {
      return Date.now() - start; // Still return time even if error
    }
  }

  startWebServer() {
    const app = express();

    app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>CodeSight MCP Server Monitoring</title>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .metric-card { background: #f5f5f5; padding: 20px; border-radius: 8px; }
            .chart-container { height: 300px; }
          </style>
        </head>
        <body>
          <h1>🔍 CodeSight MCP Server Monitoring</h1>
          <div class="dashboard">
            <div class="metric-card">
              <h3>Response Time (ms)</h3>
              <div class="chart-container">
                <canvas id="responseTimeChart"></canvas>
              </div>
            </div>
            <div class="metric-card">
              <h3>Request Statistics</h3>
              <div id="stats">
                <p>Total Requests: <span id="totalRequests">0</span></p>
                <p>Errors: <span id="errors">0</span></p>
                <p>Avg Response Time: <span id="avgResponseTime">0</span>ms</p>
              </div>
            </div>
          </div>

          <script>
            const ws = new WebSocket('ws://localhost:8080');
            const responseTimeChart = new Chart(document.getElementById('responseTimeChart'), {
              type: 'line',
              data: {
                labels: [],
                datasets: [{
                  label: 'Response Time (ms)',
                  data: [],
                  borderColor: 'rgb(75, 192, 192)',
                  tension: 0.1
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { beginAtZero: true }
                }
              }
            });

            ws.onmessage = function(event) {
              const data = JSON.parse(event.data);

              if (data.type === 'update') {
                // Update stats
                document.getElementById('totalRequests').textContent = data.requests;
                document.getElementById('errors').textContent = data.errors;
                document.getElementById('avgResponseTime').textContent = Math.round(data.avgResponseTime);

                // Update chart
                responseTimeChart.data.labels.push(new Date().toLocaleTimeString());
                responseTimeChart.data.datasets[0].data.push(data.avgResponseTime);

                // Keep only last 20 points
                if (responseTimeChart.data.labels.length > 20) {
                  responseTimeChart.data.labels.shift();
                  responseTimeChart.data.datasets[0].data.shift();
                }

                responseTimeChart.update();
              }
            };
          </script>
        </body>
        </html>
      `);
    });

    app.listen(3000, () => {
      console.log('📊 Dashboard web server running on http://localhost:3000');
    });
  }
}

// Start monitoring
const dashboard = new MonitoringDashboard('http://localhost:4000', 'your-jwt-token');
dashboard.startWebServer();
```

## Error Handling Best Practices

### Comprehensive Error Handling
```python
import requests
import json
import time
from typing import Dict, Optional
from enum import Enum

class ErrorCode(Enum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR"
    AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR"
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR"
    CODEBASE_NOT_FOUND = "CODEBASE_NOT_FOUND"
    SEARCH_ERROR = "SEARCH_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"

class CodeSightAPIError(Exception):
    def __init__(self, code: ErrorCode, message: str, details: Dict = None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(f"{code.value}: {message}")

class RobustCodeSightClient:
    def __init__(self, base_url: str, auth_token: str, max_retries: int = 3):
        self.base_url = base_url
        self.auth_token = auth_token
        self.max_retries = max_retries
        self.headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        }

    def _make_request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """Make API request with retry logic and error handling"""
        url = f"{self.base_url}{endpoint}"
        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                response = requests.request(
                    method=method,
                    url=url,
                    headers=self.headers,
                    json=data,
                    timeout=30
                )

                # Handle rate limiting
                if response.status_code == 429:
                    retry_after = int(response.headers.get('Retry-After', 5))
                    if attempt < self.max_retries:
                        print(f"Rate limited. Retrying in {retry_after} seconds...")
                        time.sleep(retry_after)
                        continue

                # Handle successful responses
                if response.status_code == 200:
                    result = response.json()
                    if not result.get('success'):
                        self._handle_api_error(result)
                    return result

                # Handle error responses
                self._handle_http_error(response)

            except requests.exceptions.Timeout:
                last_error = CodeSightAPIError(
                    ErrorCode.INTERNAL_ERROR,
                    f"Request timeout after 30 seconds (attempt {attempt + 1})"
                )
                if attempt < self.max_retries:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue

            except requests.exceptions.ConnectionError:
                last_error = CodeSightAPIError(
                    ErrorCode.INTERNAL_ERROR,
                    f"Connection error (attempt {attempt + 1})"
                )
                if attempt < self.max_retries:
                    time.sleep(2 ** attempt)
                    continue

            except requests.exceptions.RequestException as e:
                last_error = CodeSightAPIError(
                    ErrorCode.INTERNAL_ERROR,
                    f"Request failed: {str(e)}"
                )
                break

        # All retries failed
        raise last_error or CodeSightAPIError(
            ErrorCode.INTERNAL_ERROR,
            "Request failed after all retries"
        )

    def _handle_api_error(self, response: Dict):
        """Handle API-level errors"""
        error = response.get('error', {})
        code = error.get('code')
        message = error.get('message', 'Unknown API error')
        details = error.get('details', {})

        error_code_map = {
            'VALIDATION_ERROR': ErrorCode.VALIDATION_ERROR,
            'AUTHENTICATION_ERROR': ErrorCode.AUTHENTICATION_ERROR,
            'AUTHORIZATION_ERROR': ErrorCode.AUTHORIZATION_ERROR,
            'CODEBASE_NOT_FOUND': ErrorCode.CODEBASE_NOT_FOUND,
            'SEARCH_ERROR': ErrorCode.SEARCH_ERROR,
            'INTERNAL_ERROR': ErrorCode.INTERNAL_ERROR
        }

        api_error_code = error_code_map.get(code, ErrorCode.INTERNAL_ERROR)
        raise CodeSightAPIError(api_error_code, message, details)

    def _handle_http_error(self, response: requests.Response):
        """Handle HTTP-level errors"""
        if response.status_code == 401:
            raise CodeSightAPIError(
                ErrorCode.AUTHENTICATION_ERROR,
                "Authentication failed. Check your token."
            )
        elif response.status_code == 403:
            raise CodeSightAPIError(
                ErrorCode.AUTHORIZATION_ERROR,
                "You don't have permission to access this resource."
            )
        elif response.status_code == 404:
            raise CodeSightAPIError(
                ErrorCode.CODEBASE_NOT_FOUND,
                "The requested resource was not found."
            )
        elif response.status_code >= 500:
            raise CodeSightAPIError(
                ErrorCode.INTERNAL_ERROR,
                f"Server error: {response.status_code}"
            )
        else:
            try:
                error_data = response.json()
                self._handle_api_error(error_data)
            except:
                raise CodeSightAPIError(
                    ErrorCode.INTERNAL_ERROR,
                    f"HTTP {response.status_code}: {response.text}"
                )

    def search_code(self, query: str, codebase_id: str, **kwargs) -> Dict:
        """Search code with comprehensive error handling"""
        try:
            # Validate inputs
            if not query or not query.strip():
                raise ValueError("Query cannot be empty")

            if not codebase_id or not codebase_id.strip():
                raise ValueError("Codebase ID cannot be empty")

            # Make request
            data = {
                'query': query.strip(),
                'codebase_id': codebase_id.strip(),
                **kwargs
            }

            result = self._make_request('POST', '/api/queries', data)

            # Validate response
            if 'results' not in result:
                raise CodeSightAPIError(
                    ErrorCode.INTERNAL_ERROR,
                    "Invalid response format: missing results"
                )

            return result

        except ValueError as e:
            raise CodeSightAPIError(
                ErrorCode.VALIDATION_ERROR,
                str(e)
            )
        except CodeSightAPIError:
            raise
        except Exception as e:
            raise CodeSightAPIError(
                ErrorCode.INTERNAL_ERROR,
                f"Unexpected error: {str(e)}"
            )

    def safe_search_with_fallback(self, query: str, codebase_id: str, **kwargs) -> Dict:
        """Search with fallback strategies"""
        try:
            # Try full search first
            return self.search_code(query, codebase_id, **kwargs)
        except CodeSightAPIError as e:
            if e.code == ErrorCode.VALIDATION_ERROR:
                # Try with simplified query
                simplified_query = ' '.join(query.split()[:5])  # First 5 words
                print(f"Retrying with simplified query: {simplified_query}")
                return self.search_code(simplified_query, codebase_id, limit=5)
            elif e.code == ErrorCode.RATE_LIMIT_ERROR:
                # Wait and retry once
                print("Rate limited. Waiting 10 seconds...")
                time.sleep(10)
                return self.search_code(query, codebase_id, limit=5)
            else:
                raise

# Usage example
def demonstrate_error_handling():
    client = RobustCodeSightClient('http://localhost:4000', 'your-jwt-token')

    # Example 1: Normal usage
    try:
        result = client.search_code('authentication function', 'codebase-id')
        print(f"Found {len(result['results'])} results")
    except CodeSightAPIError as e:
        print(f"Search failed: {e}")

    # Example 2: With fallback
    try:
        result = client.safe_search_with_fallback('very complex query with many specific requirements', 'codebase-id')
        print(f"Fallback search found {len(result['results'])} results")
    except CodeSightAPIError as e:
        print(f"All search attempts failed: {e}")

if __name__ == "__main__":
    demonstrate_error_handling()
```

## Next Steps

- Explore the [Integration Guide](./integration-guide.md)
- Check the [Performance Optimization Guide](./performance-guide.md)
- Review the [Error Handling Reference](./error-handling.md)
- Try the [Monitoring and Debugging Tools](../monitoring/)

---

This advanced usage guide should help you get the most out of the CodeSight MCP Server API with production-ready patterns and optimizations.