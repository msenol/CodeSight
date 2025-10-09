# Prometheus Metrics Guide

## Overview

CodeSight MCP Server exports comprehensive Prometheus metrics covering all aspects of system performance, MCP tool usage, and operational health. This guide provides detailed information about available metrics, configuration, and usage patterns.

## Metrics Endpoint

Access metrics at: `http://localhost:4000/metrics`

```bash
# Check metrics endpoint
curl http://localhost:4000/metrics

# View specific metrics
curl http://localhost://4000/metrics | grep codesight_search
```

## Metric Categories

### 1. HTTP Metrics

#### Request Metrics
```prometheus
# Total HTTP requests by method, route, and status code
codesight_http_requests_total{method="GET",route="/api/codebases",status_code="200"} 1245

# Request duration histogram in milliseconds
codesight_http_request_duration_ms_bucket{method="GET",route="/api/codebases",status_code="200",le="10"} 100
codesight_http_request_duration_ms_bucket{method="GET",route="/api/codebases",status_code="200",le="25"} 200
codesight_http_request_duration_ms_bucket{method="GET",route="/api/codebases",status_code="200",le="50"} 300
codesight_http_request_duration_ms_bucket{method="GET",route="/api/codebases",status_code="200",le="+Inf"} 350
codesight_http_request_duration_ms_count{method="GET",route="/api/codebases",status_code="200"} 350
codesight_http_request_duration_ms_sum{method="GET",route="/api/codebases",status_code="200"} 12500

# Request size distribution in bytes
codesight_http_request_size_bytes_bucket{method="POST",route="/api/queries",le="1000"} 50
codesight_http_request_size_bytes_bucket{method="POST",route="/api/queries",le="+Inf"} 100
codesight_http_request_size_bytes_count{method="POST",route="/api/queries"} 100
codesight_http_request_size_bytes_sum{method="POST",route="/api/queries"} 125000

# Response size distribution in bytes
codesight_http_response_size_bytes_bucket{method="GET",route="/api/codebases",status_code="200",le="1000"} 200
codesight_http_response_size_bytes_bucket{method="GET",route="/api/codebases",status_code="200",le="+Inf"} 350
codesight_http_response_size_bytes_count{method="GET",route="/api/codebases",status_code="200"} 350
codesight_http_response_size_bytes_sum{method="GET",route="/api/codebases",status_code="200"} 450000
```

### 2. Search & Indexing Metrics

#### Search Operations
```prometheus
# Search operation counts by codebase, query type, and status
codesight_search_operations_total{codebase_id="codebase-123",query_type="natural_language",status="success"} 890
codesight_search_operations_total{codebase_id="codebase-123",query_type="structured",status="success"} 120
codesight_search_operations_total{codebase_id="codebase-123",query_type="natural_language",status="error"} 5

# Search duration histogram in milliseconds
codesight_search_duration_ms_bucket{codebase_id="codebase-123",query_type="natural_language",result_count="10",le="25"} 100
codesight_search_duration_ms_bucket{codebase_id="codebase-123",query_type="natural_language",result_count="10",le="50"} 300
codesight_search_duration_ms_bucket{codebase_id="codebase-123",query_type="natural_language",result_count="10",le="+Inf"} 350
codesight_search_duration_ms_count{codebase_id="codebase-123",query_type="natural_language",result_count="10"} 350
codesight_search_duration_ms_sum{codebase_id="codebase-123",query_type="natural_language",result_count="10"} 12500

# Search result count distribution
codesight_search_result_count_bucket{codebase_id="codebase-123",query_type="natural_language",le="1"} 50
codesight_search_result_count_bucket{codebase_id="codebase-123",query_type="natural_language",le="10"} 300
codesight_search_result_count_bucket{codebase_id="codebase-123",query_type="natural_language",le="50"} 350
codesight_search_result_count_bucket{codebase_id="codebase-123",query_type="natural_language",le="+Inf"} 400
codesight_search_result_count_count{codebase_id="codebase-123",query_type="natural_language"} 400
codesight_search_result_count_sum{codebase_id="codebase-123",query_type="natural_language"} 8500
```

#### Indexing Operations
```prometheus
# Indexing operation counts by codebase and status
codesight_indexing_operations_total{codebase_id="codebase-123",status="success"} 15
codesight_indexing_operations_total{codebase_id="codebase-123",status="error"} 1

# Indexing duration histogram in milliseconds
codesight_indexing_duration_ms_bucket{codebase_id="codebase-123",file_count="47",le="5000"} 5
codesight_indexing_duration_ms_bucket{codebase_id="codebase-123",file_count="47",le="10000"} 12
codesight_indexing_duration_ms_bucket{codebase_id="codebase-123",file_count="47",le="30000"} 18
codesight_indexing_duration_ms_bucket{codebase_id="codebase-123",file_count="47",le="+Inf"} 20
codesight_indexing_duration_ms_count{codebase_id="codebase-123",file_count="47"} 20
codesight_indexing_duration_ms_sum{codebase_id="codebase-123",file_count="47"} 125000

# Files indexed per operation by language
codesight_indexing_files_total_bucket{codebase_id="codebase-123",language="typescript",le="10"} 2
codesight_indexing_files_total_bucket{codebase_id="codebase-123",language="typescript",le="50"} 8
codesight_indexing_files_total_bucket{codebase_id="codebase-123",language="typescript",le="+Inf"} 10
codesight_indexing_files_total_count{codebase_id="codebase-123",language="typescript"} 10
codesight_indexing_files_total_sum{codebase_id="codebase-123",language="typescript"} 450
```

### 3. MCP Tools Metrics

#### Tool Usage
```prometheus
# MCP tool call counts by tool name and status
codesight_mcp_tool_calls_total{tool_name="search_code",status="success"} 1200
codesight_mcp_tool_calls_total{tool_name="search_code",status="error"} 15
codesight_mcp_tool_calls_total{tool_name="explain_function",status="success"} 350
codesight_mcp_tool_calls_total{tool_name="find_references",status="success"} 280
codesight_mcp_tool_calls_total{tool_name="trace_data_flow",status="success"} 150
codesight_mcp_tool_calls_total{tool_name="analyze_security",status="success"} 95
codesight_mcp_tool_calls_total{tool_name="get_api_endpoints",status="success"} 80
codesight_mcp_tool_calls_total{tool_name="check_complexity",status="success"} 120
codesight_mcp_tool_calls_total{tool_name="find_duplicates",status="success"} 45
codesight_mcp_tool_calls_total{tool_name="suggest_refactoring",status="success"} 60

# MCP tool duration histogram in milliseconds
codesight_mcp_tool_duration_ms_bucket{tool_name="search_code",le="100"} 200
codesight_mcp_tool_duration_ms_bucket{tool_name="search_code",le="500"} 1100
codesight_mcp_tool_duration_ms_bucket{tool_name="search_code",le="1000"} 1180
codesight_mcp_tool_duration_ms_bucket{tool_name="search_code",le="5000"} 1210
codesight_mcp_tool_duration_ms_bucket{tool_name="search_code",le="+Inf"} 1215
codesight_mcp_tool_duration_ms_count{tool_name="search_code"} 1215
codesight_mcp_tool_duration_ms_sum{tool_name="search_code"} 850000
```

### 4. Rust FFI Metrics

#### Native Performance
```prometheus
# Rust FFI call counts by function and status
codesight_rust_ffi_calls_total{function="parse_file",status="success"} 2500
codesight_rust_ffi_calls_total{function="parse_file",status="error"} 10
codesight_rust_ffi_calls_total{function="search_index",status="success"} 1200
codesight_rust_ffi_calls_total{function="search_index",status="fallback"} 5

# Rust FFI duration histogram in milliseconds
codesight_rust_ffi_duration_ms_bucket{function="parse_file",le="1"} 200
codesight_rust_ffi_duration_ms_bucket{function="parse_file",le="5"} 1800
codesight_rust_ffi_duration_ms_bucket{function="parse_file",le="10"} 2400
codesight_rust_ffi_duration_ms_bucket{function="parse_file",le="25"} 2500
codesight_rust_ffi_duration_ms_bucket{function="parse_file",le="+Inf"} 2510
codesight_rust_ffi_duration_ms_count{function="parse_file"} 2510
codesight_rust_ffi_duration_ms_sum{function="parse_file"} 12500

# Rust FFI fallback counts
codesight_rust_ffi_fallbacks_total{function="search_index",reason="library_not_found"} 3
codesight_rust_ffi_fallbacks_total{function="search_index",reason="runtime_error"} 2
codesight_rust_ffi_fallbacks_total{function="parse_file",reason="timeout"} 5
```

### 5. Database Metrics

#### Database Operations
```prometheus
# Active database connections
codesight_database_connections_active 5

# Database query counts by operation, table, and status
codesight_database_queries_total{operation="select",table="entities",status="success"} 8500
codesight_database_queries_total{operation="insert",table="entities",status="success"} 1200
codesight_database_queries_total{operation="update",table="entities",status="success"} 350
codesight_database_queries_total{operation="delete",table="entities",status="success"} 80

# Database query duration histogram in milliseconds
codesight_database_query_duration_ms_bucket{operation="select",table="entities",le="1"} 1000
codesight_database_query_duration_ms_bucket{operation="select",table="entities",le="5"} 7000
codesight_database_query_duration_ms_bucket{operation="select",table="entities",le="10"} 8200
codesight_database_query_duration_ms_bucket{operation="select",table="entities",le="25"} 8450
codesight_database_query_duration_ms_bucket{operation="select",table="entities",le="+Inf"} 8500
codesight_database_query_duration_ms_count{operation="select",table="entities"} 8500
codesight_database_query_duration_ms_sum{operation="select",table="entities"} 42500
```

### 6. System Metrics

#### Resource Usage
```prometheus
# Memory usage by type in bytes
codesight_system_memory_usage_bytes{type="heap"} 524288000
codesight_system_memory_usage_bytes{type="external"} 104857600
codesight_system_memory_usage_bytes{type="rss"} 629145600

# CPU usage percentage
codesight_system_cpu_usage_percent 25.5

# Codebase entity counts by type and codebase
codesight_codebase_entity_count{codebase_id="codebase-123",entity_type="class"} 48
codesight_codebase_entity_count{codebase_id="codebase-123",entity_type="function"} 175
codesight_codebase_entity_count{codebase_id="codebase-123",entity_type="interface"} 140
codesight_codebase_entity_count{codebase_id="codebase-123",entity_type="type"} 14

# Codebase sizes in bytes
codesight_codebase_size_bytes{codebase_id="codebase-123"} 52428800
```

### 7. Cache Metrics

#### Cache Performance
```prometheus
# Cache hits by cache type
codesight_cache_hits_total{cache_type="search"} 1200
codesight_cache_hits_total{cache_type="indexing"} 350
codesight_cache_hits_total{cache_type="mcp_tool"} 850

# Cache misses by cache type
codesight_cache_misses_total{cache_type="search"} 180
codesight_cache_misses_total{cache_type="indexing"} 50
codesight_cache_misses_total{cache_type="mcp_tool"} 150

# Cache sizes by cache type in bytes
codesight_cache_size_bytes{cache_type="search"} 104857600
codesight_cache_size_bytes{cache_type="indexing"} 52428800
codesight_cache_size_bytes{cache_type="mcp_tool"} 26214400
```

### 8. Error Metrics

#### Error Tracking
```prometheus
# Error counts by type and component
codesight_errors_total{error_type="ValidationError",component="search-service"} 25
codesight_errors_total{error_type="DatabaseError",component="indexing-service"} 8
codesight_errors_total{error_type="FFIError",component="rust-bridge"} 3
codesight_errors_total{error_type="TimeoutError",component="mcp-server"} 12
codesight_errors_total{error_type="AuthenticationError",component="auth-middleware"} 5
```

## Configuration

### Enable Metrics

```typescript
import { metricsMiddleware, SystemMetricsCollector } from './monitoring/prometheus-exporter';

// Enable metrics collection in Express app
app.use(metricsMiddleware);

// Start system metrics collection
SystemMetricsCollector.startCollecting(30000); // Collect every 30 seconds
```

### Custom Metrics

Create custom metrics for application-specific monitoring:

```typescript
import { register, Counter, Histogram } from 'prom-client';

// Custom counter
const customOperationsTotal = new Counter({
  name: 'codesight_custom_operations_total',
  help: 'Total number of custom operations',
  labelNames: ['operation_type', 'status'],
  registers: [metricsRegistry]
});

// Custom histogram
const customOperationDuration = new Histogram({
  name: 'codesight_custom_operation_duration_ms',
  help: 'Duration of custom operations in milliseconds',
  labelNames: ['operation_type'],
  buckets: [100, 500, 1000, 5000, 10000],
  registers: [metricsRegistry]
});

// Use custom metrics
customOperationsTotal.labels('data_processing', 'success').inc();
customOperationDuration.labels('data_processing').observe(1250);
```

### Metrics Collection

Automatic metrics collection for operations:

```typescript
import { SearchMetricsCollector, IndexingMetricsCollector } from './monitoring/prometheus-exporter';

// Search operation with automatic metrics
const endTimer = SearchMetricsCollector.startSearch('codebase-123', 'natural_language');

try {
  const results = await performSearch(query);
  endTimer(results.length, 'success');
  return results;
} catch (error) {
  endTimer(0, 'error');
  throw error;
}

// Indexing operation with automatic metrics
const endTimer = IndexingMetricsCollector.startIndexing('codebase-123');

try {
  const fileCount = await performIndexing(codebasePath);
  endTimer(fileCount, 'typescript', 'success');
  return fileCount;
} catch (error) {
  endTimer(0, 'unknown', 'error');
  throw error;
}
```

## Prometheus Configuration

### Prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'codesight-mcp-server'
    static_configs:
      - targets: ['localhost:4000']
    metrics_path: '/metrics'
    scrape_interval: 10s
    scrape_timeout: 5s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Service Discovery

For dynamic environments, use service discovery:

```yaml
scrape_configs:
  - job_name: 'codesight-mcp-server'
    consul_sd_configs:
      - server: 'consul:8500'
        services: ['codesight-mcp-server']
    relabel_configs:
      - source_labels: [__meta_consul_tags]
        regex: .*,metrics,.*
        action: keep
```

## Useful Queries

### Performance Queries

**Average Response Time:**
```promql
rate(codesight_http_request_duration_ms_sum[5m]) /
rate(codesight_http_request_duration_ms_count[5m])
```

**95th Percentile Response Time:**
```promql
histogram_quantile(0.95, rate(codesight_http_request_duration_ms_bucket[5m]))
```

**Request Rate:**
```promql
sum(rate(codesight_http_requests_total[5m])) by (method, route)
```

**Error Rate:**
```promql
sum(rate(codesight_http_requests_total{status_code=~"5.."}[5m])) /
sum(rate(codesight_http_requests_total[5m]))
```

### Search Performance Queries

**Search Success Rate:**
```promql
sum(rate(codesight_search_operations_total{status="success"}[5m])) /
sum(rate(codesight_search_operations_total[5m]))
```

**Average Search Duration:**
```promql
rate(codesight_search_duration_ms_sum[5m]) /
rate(codesight_search_duration_ms_count[5m])
```

**Search Throughput:**
```promql
sum(rate(codesight_search_operations_total[5m])) by (query_type)
```

### MCP Tool Usage Queries

**Most Used Tools:**
```promql
topk(10, sum(rate(codesight_mcp_tool_calls_total[5m])) by (tool_name))
```

**Tool Success Rate:**
```promql
sum(rate(codesight_mcp_tool_calls_total{status="success"}[5m])) by (tool_name) /
sum(rate(codesight_mcp_tool_calls_total[5m])) by (tool_name)
```

**Tool Performance:**
```promql
histogram_quantile(0.95, sum(rate(codesight_mcp_tool_duration_ms_bucket[5m])) by (le, tool_name))
```

### System Resource Queries

**Memory Usage:**
```promql
codesight_system_memory_usage_bytes{type="heap"} / 1024 / 1024
```

**CPU Usage:**
```promql
rate(codesight_system_cpu_usage_percent[5m])
```

**Database Connection Usage:**
```promql
codesight_database_connections_active
```

### Cache Performance Queries

**Cache Hit Rate:**
```promql
sum(rate(codesight_cache_hits_total[5m])) by (cache_type) /
(sum(rate(codesight_cache_hits_total[5m])) by (cache_type) + sum(rate(codesight_cache_misses_total[5m])) by (cache_type))
```

**Cache Utilization:**
```promql
codesight_cache_size_bytes / 1024 / 1024
```

## Alerting Rules

### Performance Alerts

```yaml
groups:
  - name: codesight-performance
    rules:
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(codesight_http_request_duration_ms_bucket[5m])) > 1000
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}ms"

      - alert: HighErrorRate
        expr: sum(rate(codesight_http_requests_total{status_code=~"5.."}[5m])) / sum(rate(codesight_http_requests_total[5m])) > 0.05
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: HighMemoryUsage
        expr: codesight_system_memory_usage_bytes{type="heap"} / 1024 / 1024 > 1024
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value }}MB"

      - alert: DatabaseConnectionLeak
        expr: rate(codesight_database_connections_active[5m]) > 100
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection leak detected"
          description: "Database connections are increasing rapidly"
```

### Business Metrics Alerts

```yaml
  - name: codesight-business
    rules:
      - alert: LowSearchSuccessRate
        expr: sum(rate(codesight_search_operations_total{status="success"}[5m])) / sum(rate(codesight_search_operations_total[5m])) < 0.95
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "Low search success rate"
          description: "Search success rate is {{ $value | humanizePercentage }}"

      - alert: MCPToolErrors
        expr: sum(rate(codesight_mcp_tool_calls_total{status="error"}[5m])) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "MCP tool errors detected"
          description: "MCP tool error rate is {{ $value }} errors/minute"
```

## Dashboard Examples

### System Overview Panel

```json
{
  "title": "Request Rate",
  "type": "graph",
  "targets": [
    {
      "expr": "sum(rate(codesight_http_requests_total[5m])) by (method)",
      "legendFormat": "{{method}}"
    }
  ],
  "yAxes": [
    {
      "label": "Requests/sec"
    }
  ]
}
```

### Search Performance Panel

```json
{
  "title": "Search Response Time",
  "type": "graph",
  "targets": [
    {
      "expr": "histogram_quantile(0.50, rate(codesight_search_duration_ms_bucket[5m]))",
      "legendFormat": "50th percentile"
    },
    {
      "expr": "histogram_quantile(0.95, rate(codesight_search_duration_ms_bucket[5m]))",
      "legendFormat": "95th percentile"
    },
    {
      "expr": "histogram_quantile(0.99, rate(codesight_search_duration_ms_bucket[5m]))",
      "legendFormat": "99th percentile"
    }
  ],
  "yAxes": [
    {
      "label": "Response Time (ms)"
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **Metrics Not Available**
   ```bash
   # Check if metrics endpoint is accessible
   curl -f http://localhost:4000/metrics

   # Check server logs for errors
   docker logs codesight-mcp-server
   ```

2. **High Memory Usage**
   ```promql
   # Monitor memory usage trends
   codesight_system_memory_usage_bytes{type="heap"}

   # Check for memory leaks
   rate(codesight_system_memory_usage_bytes{type="heap"}[1h])
   ```

3. **Slow Queries**
   ```promql
   # Identify slow database queries
   rate(codesight_database_query_duration_ms_sum[5m]) /
   rate(codesight_database_query_duration_ms_count[5m])
   ```

4. **MCP Tool Errors**
   ```promql
   # Check MCP tool error rates
   sum(rate(codesight_mcp_tool_calls_total{status="error"}[5m])) by (tool_name)
   ```

## Best Practices

1. **Label Consistency**: Use consistent label naming conventions
2. **Metric Naming**: Follow Prometheus naming conventions
3. **Cardinality**: Avoid high cardinality labels
4. **Retention**: Configure appropriate retention periods
5. **Alerting**: Set up meaningful alerts with appropriate thresholds
6. **Dashboarding**: Create dashboards for different audiences
7. **Documentation**: Document custom metrics and their meanings

## Next Steps

1. **Set up Prometheus**: Configure Prometheus to scrape metrics
2. **Create Dashboards**: Build Grafana dashboards for monitoring
3. **Configure Alerting**: Set up alerts for critical metrics
4. **Monitor Performance**: Use metrics to optimize performance
5. **Scale Monitoring**: Plan for monitoring scale and reliability