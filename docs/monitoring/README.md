# Monitoring & Observability Guide

## Overview

CodeSight MCP Server includes comprehensive monitoring and observability capabilities designed for enterprise production environments. This guide covers the complete monitoring stack including metrics collection, distributed tracing, and visualization.

## Monitoring Stack Components

### 1. Prometheus Metrics
- Custom metrics for all MCP operations
- System resource monitoring
- Performance tracking
- Error rate monitoring

### 2. OpenTelemetry Tracing
- Distributed tracing for request flows
- Performance bottleneck identification
- Cross-service correlation
- Jaeger, Zipkin, and OTLP support

### 3. Grafana Dashboards
- Pre-built dashboards for common monitoring needs
- Real-time visualization
- Alerting capabilities
- Historical trend analysis

### 4. Structured Logging
- JSON-based logging format
- Correlation IDs for request tracing
- Configurable log levels
- Integration with external log aggregators

## Quick Start

### 1. Enable Monitoring

Add monitoring configuration to your `.env` file:

```bash
# Enable monitoring
MONITORING_ENABLED=true

# Metrics configuration
METRICS_ENABLED=true
METRICS_PORT=9090

# Tracing configuration
TRACING_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_SERVICE_NAME=codesight-mcp-server
TRACING_SAMPLER_RATIO=0.1

# Logging configuration
LOG_LEVEL=info
LOG_FORMAT=json
```

### 2. Start with Docker Compose

Use the provided monitoring stack:

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

This starts:
- CodeSight MCP Server with monitoring enabled
- Prometheus for metrics collection
- Grafana for visualization
- Jaeger for distributed tracing

### 3. Access Monitoring Interfaces

- **Grafana Dashboard**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger UI**: http://localhost:16686
- **Metrics Endpoint**: http://localhost:4000/metrics

## Prometheus Metrics

### Available Metrics

#### HTTP Metrics
- `codesight_http_requests_total` - Total HTTP requests by method, route, and status
- `codesight_http_request_duration_ms` - Request duration in milliseconds
- `codesight_http_request_size_bytes` - Request size distribution
- `codesight_http_response_size_bytes` - Response size distribution

#### Search & Indexing Metrics
- `codesight_search_operations_total` - Search operation counts by type and status
- `codesight_search_duration_ms` - Search operation performance
- `codesight_search_result_count` - Search result distribution
- `codesight_indexing_operations_total` - Indexing operation tracking
- `codesight_indexing_duration_ms` - Indexing performance metrics
- `codesight_indexing_files_total` - Files processed per indexing operation

#### MCP Tools Metrics
- `codesight_mcp_tool_calls_total` - MCP tool usage by tool name and status
- `codesight_mcp_tool_duration_ms` - MCP tool performance tracking

#### Rust FFI Metrics
- `codesight_rust_ffi_calls_total` - Rust FFI function call tracking
- `codesight_rust_ffi_duration_ms` - Rust FFI performance metrics
- `codesight_rust_ffi_fallbacks_total` - Fallback to TypeScript tracking

#### Database Metrics
- `codesight_database_connections_active` - Active database connections
- `codesight_database_queries_total` - Database query counts
- `codesight_database_query_duration_ms` - Database performance tracking

#### System Metrics
- `codesight_system_memory_usage_bytes` - Memory usage by type (heap, external, RSS)
- `codesight_system_cpu_usage_percent` - CPU usage percentage
- `codesight_codebase_entity_count` - Entity counts by type and codebase
- `codesight_codebase_size_bytes` - Codebase sizes

#### Cache Metrics
- `codesight_cache_hits_total` - Cache hits by cache type
- `codesight_cache_misses_total` - Cache misses by cache type
- `codesight_cache_size_bytes` - Cache sizes by type

#### Error Metrics
- `codesight_errors_total` - Error counts by type and component

### Metrics Configuration

Custom metrics collection:

```typescript
import { SearchMetricsCollector } from './monitoring/prometheus-exporter';

// Start search operation timing
const endTimer = SearchMetricsCollector.startSearch('codebase-123', 'natural-language');

// Perform search operation
const results = await performSearch(query);

// Record completion
endTimer(results.length, 'success');
```

### Prometheus Queries

Useful queries for monitoring:

**Request Rate:**
```promql
rate(codesight_http_requests_total[5m]) by (method, route)
```

**Error Rate:**
```promql
rate(codesight_http_requests_total{status_code=~"5.."}[5m]) /
rate(codesight_http_requests_total[5m])
```

**Search Performance:**
```promql
histogram_quantile(0.95, rate(codesight_search_duration_ms_bucket[5m]))
```

**Memory Usage:**
```promql
codesight_system_memory_usage_bytes{type="heap"}
```

## OpenTelemetry Tracing

### Tracing Configuration

Enable tracing in your environment:

```bash
# OpenTelemetry configuration
OTEL_SERVICE_NAME=codesight-mcp-server
OTEL_SERVICE_VERSION=0.1.0
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.instance.id=instance-1
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_EXPORTER_OTLP_HEADERS=authorization=Bearer your-token
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
```

### Supported Exporters

#### Jaeger
```typescript
import { initializeTracing } from './monitoring/otel-tracing';

initializeTracing({
  serviceName: 'codesight-mcp-server',
  jaeger: {
    endpoint: 'http://localhost:14268/api/traces'
  }
});
```

#### Zipkin
```typescript
initializeTracing({
  serviceName: 'codesight-mcp-server',
  zipkin: {
    endpoint: 'http://localhost:9411/api/v2/spans'
  }
});
```

#### OTLP (Honeycomb, Lightstep, etc.)
```typescript
initializeTracing({
  serviceName: 'codesight-mcp-server',
  otlp: {
    endpoint: 'https://api.honeycomb.io/v1/traces',
    headers: {
      'x-honeycomb-team': 'your-api-key'
    }
  }
});
```

### Creating Spans

Manual span creation for custom instrumentation:

```typescript
import { TracingUtils } from './monitoring/otel-tracing';

// Create a search span
const span = TracingUtils.startSearchSpan(
  'find user authentication logic',
  'codebase-123',
  'natural-language'
);

try {
  // Perform search operation
  const results = await performSearch(query);

  // Record success
  TracingUtils.recordSuccess(span, {
    resultCount: results.length,
    duration: performance.now()
  });

  return results;
} catch (error) {
  // Record error
  TracingUtils.recordError(span, error as Error);
  throw error;
} finally {
  span.end();
}
```

### Automatic Instrumentation

The server includes automatic instrumentation for:

- **HTTP Requests**: Express middleware automatically traces all HTTP requests
- **Database Queries**: SQL operations are automatically traced
- **MCP Tool Calls**: All MCP tool invocations are traced
- **Rust FFI Calls**: Native library calls are instrumented

### Decorator-Based Tracing

Use decorators for automatic method tracing:

```typescript
import { traceable } from './monitoring/otel-tracing';

class SearchService {
  @traceable('search-operation', { operation: 'natural-language' })
  async search(query: string, codebaseId: string): Promise<SearchResult[]> {
    // Method implementation
    // Automatically creates spans with performance tracking
  }

  @traceable('indexing-operation')
  async indexFile(filePath: string): Promise<void> {
    // Method implementation
    // Automatic error handling and span recording
  }
}
```

## Grafana Dashboards

### Available Dashboards

#### 1. System Overview
- CPU and memory usage
- Request rate and error rate
- Active connections
- System health indicators

#### 2. API Performance
- Response time histograms
- Request throughput
- Error rates by endpoint
- Status code distribution

#### 3. MCP Tools Analytics
- Tool usage frequency
- Tool performance metrics
- Tool-specific error rates
- Popular search queries

#### 4. Database Operations
- Query performance
- Connection pool metrics
- Database size trends
- Query type distribution

#### 5. Rust FFI Performance
- FFI call rates
- Native vs TypeScript performance
- Fallback occurrences
- FFI operation latency

### Importing Dashboards

Dashboards are available in the `monitoring/grafana/dashboards/` directory:

```bash
# Import all dashboards
curl -X POST \
  http://admin:admin@localhost:3000/api/dashboards/db \
  -H 'Content-Type: application/json' \
  -d @monitoring/grafana/dashboards/system-overview.json
```

### Custom Dashboards

Create custom dashboards using the Grafana UI:

1. Navigate to http://localhost:3000
2. Click "Create" → "Dashboard"
3. Add panels using Prometheus queries
4. Save and share your dashboard

Example panel configuration:

```json
{
  "title": "Search Response Time",
  "type": "graph",
  "targets": [
    {
      "expr": "histogram_quantile(0.95, rate(codesight_search_duration_ms_bucket[5m]))",
      "legendFormat": "95th percentile"
    },
    {
      "expr": "histogram_quantile(0.50, rate(codesight_search_duration_ms_bucket[5m]))",
      "legendFormat": "50th percentile"
    }
  ]
}
```

## Structured Logging

### Log Format

Logs are emitted in JSON format for easy parsing and analysis:

```json
{
  "timestamp": "2025-01-09T10:30:45.123Z",
  "level": "info",
  "message": "Search operation completed",
  "trace_id": "1234567890abcdef",
  "span_id": "abcdef1234567890",
  "component": "search-service",
  "operation": "search",
  "duration_ms": 45,
  "result_count": 12,
  "query": "user authentication",
  "codebase_id": "codebase-123"
}
```

### Log Levels

Configure log levels based on environment:

```bash
# Development - verbose logging
LOG_LEVEL=debug

# Production - error logging only
LOG_LEVEL=error

# Staging - info level
LOG_LEVEL=info
```

### Log Correlation

Logs include correlation IDs for request tracing:

```typescript
import { addSpanAttributes } from './monitoring/otel-tracing';

// Add custom attributes to current span
addSpanAttributes({
  user_id: 'user-123',
  request_id: 'req-456',
  feature_flag: 'advanced_search'
});
```

## Alerting

### Prometheus Alerting Rules

Configure alerting rules in `monitoring/alerts.yml`:

```yaml
groups:
  - name: codesight-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(codesight_http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighMemoryUsage
        expr: codesight_system_memory_usage_bytes{type="heap"} / 1024/1024 > 1000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value }}MB"
```

### Grafana Alerting

Configure alerts in Grafana:

1. Navigate to "Alerting" → "Notification channels"
2. Add notification channels (Slack, Email, PagerDuty)
3. Create alert rules on dashboard panels
4. Set up alert conditions and notification rules

## Performance Monitoring

### Key Performance Indicators

Monitor these KPIs for system health:

1. **Response Time**: 95th percentile < 100ms
2. **Error Rate**: < 1% of total requests
3. **Throughput**: Requests per second
4. **Memory Usage**: < 1GB for typical workloads
5. **CPU Usage**: < 80% sustained usage
6. **Database Latency**: Query response times
7. **Cache Hit Rate**: > 80% for frequently accessed data

### Performance Baselines

Establish performance baselines:

```typescript
// Track performance metrics
const baselineMetrics = {
  searchResponseTime: {
    p50: 25,  // ms
    p95: 100, // ms
    p99: 250  // ms
  },
  indexingThroughput: {
    filesPerSecond: 50
  },
  memoryUsage: {
    baseline: 512, // MB
    warning: 1024, // MB
    critical: 2048 // MB
  }
};
```

### Bottleneck Identification

Use tracing to identify performance bottlenecks:

1. **Slow Requests**: Identify requests exceeding performance thresholds
2. **Database Queries**: Find slow or frequent queries
3. **FFI Operations**: Monitor Rust vs TypeScript performance
4. **Memory Allocation**: Track memory-intensive operations
5. **Concurrency Issues**: Identify lock contention or race conditions

## Troubleshooting Monitoring

### Common Issues

1. **Metrics Not Available**
   - Check if metrics endpoint is accessible: `curl http://localhost:4000/metrics`
   - Verify monitoring is enabled in configuration
   - Check Prometheus configuration

2. **Tracing Not Working**
   - Verify OpenTelemetry configuration
   - Check exporter endpoints are accessible
   - Review sampling configuration

3. **Dashboard Not Loading**
   - Check Grafana service status
   - Verify Prometheus data source configuration
   - Review dashboard JSON syntax

4. **High Memory Usage**
   - Check for memory leaks in application
   - Monitor garbage collection metrics
   - Review cache configuration

### Debugging Tools

Use these tools for monitoring troubleshooting:

```bash
# Check metrics endpoint
curl http://localhost:4000/metrics

# Test tracing
curl -X POST http://localhost:4000/api/tools/search_code \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# Check system resources
htop
iotop
netstat -tulpn

# Debug Docker services
docker-compose logs monitoring
docker-compose ps
```

## Production Deployment

### Monitoring Architecture

Production monitoring architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CodeSight     │───▶│   Prometheus    │───▶│    Grafana      │
│   MCP Server    │    │   (Metrics)     │    │   (Dashboard)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  OpenTelemetry  │───▶│     Jaeger      │───▶│   Alertmanager  │
│    (Tracing)    │    │   (Tracing)     │    │   (Alerts)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Scaling Considerations

1. **Prometheus**: Configure federation for multi-region monitoring
2. **Grafana**: Use high availability deployment
3. **Jaeger**: Scale collector and storage components
4. **Logging**: Centralized log aggregation with ELK stack
5. **Alerting**: Configure escalation policies and on-call rotations

### Security

1. **Authentication**: Enable authentication on monitoring endpoints
2. **Authorization**: Restrict access to sensitive metrics
3. **Network Security**: Use VPN or private networks for monitoring traffic
4. **Data Retention**: Configure appropriate retention policies
5. **Encryption**: Encrypt monitoring data in transit and at rest

## Next Steps

1. **Configure Monitoring**: Set up monitoring stack for your environment
2. **Create Dashboards**: Build custom dashboards for your specific needs
3. **Set Up Alerting**: Configure alerts for critical metrics
4. **Establish Baselines**: Define performance baselines and SLAs
5. **Monitor in Production**: Deploy monitoring to production environment
6. **Optimize Performance**: Use monitoring data to optimize performance