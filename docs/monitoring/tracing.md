# OpenTelemetry Tracing Guide

## Overview

This guide covers OpenTelemetry distributed tracing implementation for the CodeSight MCP Server. Tracing provides visibility into request flows, performance bottlenecks, and cross-service interactions.

## Supported Exporters

### Jaeger
- **Endpoint**: `http://localhost:14268/api/traces`
- **UI**: http://localhost:16686
- **Best for**: Development environments, local testing

### Zipkin
- **Endpoint**: `http://localhost:9411/api/v2/spans`
- **UI**: http://localhost:9411
- **Best for**: Simple deployments, lightweight tracing

### OTLP (OpenTelemetry Protocol)
- **Supported Services**: Honeycomb, Lightstep, Datadog, etc.
- **Format**: Binary protobuf over HTTP/gRPC
- **Best for**: Production environments, cloud services

## Configuration

### Environment Variables

```bash
# Required OpenTelemetry configuration
OTEL_SERVICE_NAME=codesight-mcp-server
OTEL_SERVICE_VERSION=0.1.0
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.instance.id=instance-1

# Exporter configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_EXPORTER_OTLP_HEADERS=authorization=Bearer your-token

# Sampling configuration
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
```

### Jaeger Configuration

```typescript
import { initializeTracing } from '../monitoring/otel-tracing';

initializeTracing({
  serviceName: 'codesight-mcp-server',
  jaeger: {
    endpoint: 'http://localhost:14268/api/traces'
  }
});
```

### Zipkin Configuration

```typescript
initializeTracing({
  serviceName: 'codesight-mcp-server',
  zipkin: {
    endpoint: 'http://localhost:9411/api/v2/spans'
  }
});
```

### OTLP Configuration

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

## Automatic Instrumentation

The server includes automatic instrumentation for:

- **HTTP Requests**: Express middleware traces all requests
- **Database Queries**: SQL operations are automatically traced
- **MCP Tool Calls**: All MCP tool invocations are traced
- **Rust FFI Calls**: Native library calls are instrumented

## Manual Instrumentation

### Creating Spans

```typescript
import { TracingUtils } from '../monitoring/otel-tracing';

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

### Decorator-Based Tracing

```typescript
import { traceable } from '../monitoring/otel-tracing';

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

### Adding Custom Attributes

```typescript
import { addSpanAttributes } from '../monitoring/otel-tracing';

// Add custom attributes to current span
addSpanAttributes({
  user_id: 'user-123',
  request_id: 'req-456',
  feature_flag: 'advanced_search',
  query_complexity: 'high'
});
```

## Span Types and Naming

### Operation Types

- **search-operation**: Search and query operations
- **indexing-operation**: File and codebase indexing
- **analysis-operation**: Code analysis and complexity checks
- **mcp-tool-operation**: MCP tool invocations
- **rust-ffi-operation**: Native library calls
- **database-operation**: Database queries and transactions

### Span Naming Conventions

```typescript
// Good: Descriptive and specific
'codesight.search.natural-language'
'codesight.indexing.file-typescript'
'codesight.mcp-tool.find-references'
'codesight.rust-ffi.tree-sitter-parse'

// Bad: Too generic
'operation'
'search'
'function'
```

## Performance Monitoring

### Identifying Bottlenecks

Use tracing to identify performance issues:

1. **Slow Requests**: Identify requests exceeding performance thresholds
2. **Database Queries**: Find slow or frequent queries
3. **FFI Operations**: Monitor Rust vs TypeScript performance
4. **Memory Allocation**: Track memory-intensive operations
5. **Concurrency Issues**: Identify lock contention or race conditions

### Trace Analysis

#### Key Metrics to Monitor

- **Span Duration**: Total time for operations
- **Child Span Count**: Number of nested operations
- **Error Rate**: Percentage of failed operations
- **Trace Depth**: Nesting level of operations

#### Common Performance Patterns

```typescript
// Database query optimization example
@traceable('database-operation', { query_type: 'search_entities' })
async searchEntities(query: string): Promise<Entity[]> {
  // Add query complexity metrics
  addSpanAttributes({
    query_length: query.length,
    query_type: detectQueryType(query)
  });

  return await this.database.query(query);
}
```

## Integration with Monitoring

### Correlation with Logs

Traces include correlation IDs that appear in logs:

```json
{
  "timestamp": "2025-01-09T10:30:45.123Z",
  "level": "info",
  "message": "Search operation completed",
  "trace_id": "1234567890abcdef",
  "span_id": "abcdef1234567890",
  "component": "search-service"
}
```

### Metrics Integration

Combine traces with metrics for comprehensive monitoring:

```typescript
// Custom metrics with tracing context
const searchDuration = SearchMetricsCollector.startSearch();
const span = TracingUtils.startSearchSpan(query, codebaseId);

try {
  const results = await performSearch(query);

  // Record both metric and trace
  searchDuration(results.length, 'success');
  TracingUtils.recordSuccess(span, { resultCount: results.length });

  return results;
} catch (error) {
  searchDuration(0, 'error');
  TracingUtils.recordError(span, error);
  throw error;
} finally {
  span.end();
}
```

## Production Deployment

### Sampling Strategies

#### Head-Based Sampling

```typescript
// Sample 10% of traces
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
```

#### Tail-Based Sampling

```typescript
// Sample all error traces
const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(0.1),
  remoteParentSampled: new AlwaysOnSampler()
});
```

### Collector Configuration

#### Jaeger Collector

```yaml
# docker-compose.yml
version: '3.8'
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # Jaeger UI
      - "14268:14268"  # HTTP collector
      - "14250:14250"  # gRPC collector
    environment:
      - COLLECTOR_OTLP_ENABLED=true
```

#### OpenTelemetry Collector

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
  memory_limiter:
    limit_mib: 512

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [jaeger]
```

## Security Considerations

### Data Sanitization

```typescript
// Sanitize sensitive data in traces
const sanitizedQuery = sanitizeQuery(userInput);
addSpanAttributes({
  query: sanitizedQuery,
  query_hash: hashQuery(userInput) // Store hash for correlation
});
```

### Authentication

```typescript
// Secure exporter configuration
initializeTracing({
  serviceName: 'codesight-mcp-server',
  otlp: {
    endpoint: 'https://api.honeycomb.io/v1/traces',
    headers: {
      'x-honeycomb-team': process.env.HONEYCOMB_API_KEY
    },
    compression: 'gzip'
  }
});
```

## Troubleshooting

### Common Issues

1. **Traces Not Appearing**
   - Check exporter endpoint configuration
   - Verify network connectivity to collector
   - Review sampling configuration

2. **Missing Spans**
   - Ensure automatic instrumentation is initialized
   - Check decorator applications
   - Verify span lifecycle management

3. **High Overhead**
   - Adjust sampling rates
   - Review span attributes for large data
   - Consider asynchronous span recording

### Debug Mode

```typescript
// Enable debug logging for tracing
process.env.OTEL_LOG_LEVEL = 'debug';
process.env.OTEL_EXPORTER_JAEGER_AGENT_HOST = 'localhost';
```

## Best Practices

### Span Design

1. **Keep spans focused** on single operations
2. **Add meaningful attributes** for context
3. **Use consistent naming** conventions
4. **Record events** at key points
5. **Set appropriate span kinds** (SERVER, CLIENT, INTERNAL)

### Performance Optimization

1. **Use sampling** to reduce overhead
2. **Batch trace exports** for efficiency
3. **Limit attribute sizes** and counts
4. **Use efficient serialization**
5. **Monitor trace collector performance**

### Error Handling

1. **Record errors with context**
2. **Include error types and messages**
3. **Add stack traces for debugging**
4. **Monitor error rates by operation**
5. **Set up alerts for error spikes**

## Integration Examples

### With Express.js

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('codesight-express');

app.use((req, res, next) => {
  const span = tracer.startSpan('http-request', {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.user_agent': req.headers['user-agent']
    }
  });

  res.on('finish', () => {
    span.setAttributes({
      'http.status_code': res.statusCode
    });
    span.end();
  });

  next();
});
```

### With Database Operations

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('codesight-database');

async function queryDatabase(sql: string, params: any[]) {
  const span = tracer.startSpan('database-query', {
    attributes: {
      'db.system': 'sqlite',
      'db.statement': sql,
      'db.operation': extractOperation(sql)
    }
  });

  try {
    const result = await database.query(sql, params);
    span.setAttribute('db.rows_affected', result.rowCount);
    return result;
  } catch (error) {
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

## Conclusion

OpenTelemetry tracing provides comprehensive visibility into the CodeSight MCP Server's operations. By implementing proper tracing practices, you can:

- Identify performance bottlenecks quickly
- Debug complex request flows
- Monitor system health effectively
- Optimize resource utilization
- Improve overall system reliability

For additional configuration options and advanced use cases, refer to the [OpenTelemetry documentation](https://opentelemetry.io/docs/).