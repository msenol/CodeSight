/**
 * OpenTelemetry Tracing Setup for CodeSight MCP Server
 * Provides comprehensive distributed tracing capabilities
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import {
  SimpleSpanProcessor,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  JaegerExporter,
  ZipkinExporter,
  OTLPTraceExporter
} from '@opentelemetry/sdk-trace-node';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { trace, SpanKind, SpanStatusCode, context, Span } from '@opentelemetry/api';
import { performance } from 'perf_hooks';

// Global tracer provider
let tracerProvider: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry tracing
 */
export function initializeTracing(config: TracingConfig): void {
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName || 'codesight-mcp-server',
    [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion || '0.1.0',
    [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: config.instanceId || generateInstanceId(),
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment || 'development',
    'codesight.node_version': process.version,
    'codesight.platform': process.platform,
    'codesight.arch': process.arch
  });

  const exporters: any[] = [];

  // Console exporter for development
  if (config.console) {
    exporters.push(new ConsoleSpanExporter());
  }

  // Jaeger exporter
  if (config.jaeger) {
    exporters.push(new JaegerExporter({
      endpoint: config.jaeger.endpoint || 'http://localhost:14268/api/traces',
      headers: config.jaeger.headers || {}
    }));
  }

  // Zipkin exporter
  if (config.zipkin) {
    exporters.push(new ZipkinExporter({
      endpoint: config.zipkin.endpoint || 'http://localhost:9411/api/v2/spans',
      headers: config.zipkin.headers || {}
    }));
  }

  // OTLP exporter (for services like Honeycomb, Lightstep, etc.)
  if (config.otlp) {
    exporters.push(new OTLPTraceExporter({
      url: config.otlp.endpoint || 'http://localhost:4318/v1/traces',
      headers: config.otlp.headers || {}
    }));
  }

  if (exporters.length === 0) {
    console.warn('No tracing exporters configured. Tracing will be disabled.');
    return;
  }

  // Create span processors
  const spanProcessors = exporters.map(exporter => {
    if (config.batch === false) {
      return new SimpleSpanProcessor(exporter);
    } else {
      return new BatchSpanProcessor(exporter, {
        maxExportBatchSize: config.batchSize || 512,
        scheduledDelayMillis: config.batchDelayMs || 5000,
        maxExportTimeoutMillis: config.batchTimeoutMs || 30000
      });
    }
  });

  // Initialize SDK
  tracerProvider = new NodeSDK({
    resource,
    spanProcessors,
    instrumentations: [
      new ExpressInstrumentation(),
      new HttpInstrumentation(),
      ...(config.loggerInstrumentation ? [new PinoInstrumentation()] : [])
    ],
    serviceName: config.serviceName || 'codesight-mcp-server',
    sampler: config.sampler || {
      // Default to sampling 10% of traces in production, 100% in development
      type: 'traceidratio',
      ratio: config.environment === 'production' ? 0.1 : 1.0
    }
  });

  try {
    tracerProvider.start();
    console.log('OpenTelemetry tracing initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry tracing:', error);
  }
}

/**
 * Shutdown tracing provider
 */
export async function shutdownTracing(): Promise<void> {
  if (tracerProvider) {
    try {
      await tracerProvider.shutdown();
      console.log('OpenTelemetry tracing shutdown completed');
    } catch (error) {
      console.error('Error shutting down OpenTelemetry tracing:', error);
    }
  }
}

/**
 * Tracing configuration interface
 */
export interface TracingConfig {
  serviceName?: string;
  serviceVersion?: string;
  instanceId?: string;
  environment?: string;
  console?: boolean;
  jaeger?: {
    endpoint?: string;
    headers?: Record<string, string>;
  };
  zipkin?: {
    endpoint?: string;
    headers?: Record<string, string>;
  };
  otlp?: {
    endpoint?: string;
    headers?: Record<string, string>;
  };
  batch?: boolean;
  batchSize?: number;
  batchDelayMs?: number;
  batchTimeoutMs?: number;
  sampler?: {
    type: string;
    ratio: number;
  };
  loggerInstrumentation?: boolean;
}

/**
 * Tracing utilities for different operations
 */
export class TracingUtils {
  private static tracer = trace.getTracer('codesight-mcp', '0.1.0');

  /**
   * Start a span for HTTP requests
   */
  static startHttpSpan(
    operationName: string,
    method: string,
    url: string,
    headers?: Record<string, string>
  ): Span {
    const span = this.tracer.startSpan(operationName, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': method,
        'http.url': url,
        'http.scheme': new URL(url).protocol.slice(0, -1),
        'net.host.name': new URL(url).hostname,
        'net.host.port': new URL(url).port || (new URL(url).protocol === 'https:' ? 443 : 80)
      }
    });

    // Add headers as attributes if provided
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        span.setAttribute(`http.request.header.${key.toLowerCase()}`, value);
      });
    }

    return span;
  }

  /**
   * Start a span for search operations
   */
  static startSearchSpan(
    query: string,
    codebaseId: string,
    queryType: string = 'standard'
  ): Span {
    return this.tracer.startSpan('codesight.search', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'codesight.operation.type': 'search',
        'codesight.search.query': query,
        'codesight.search.codebase_id': codebaseId,
        'codesight.search.query_type': queryType,
        'codesight.search.query_length': query.length
      }
    });
  }

  /**
   * Start a span for indexing operations
   */
  static startIndexingSpan(
    codebaseId: string,
    filePath: string,
    language: string
  ): Span {
    return this.tracer.startSpan('codesight.indexing', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'codesight.operation.type': 'indexing',
        'codesight.indexing.codebase_id': codebaseId,
        'codesight.indexing.file_path': filePath,
        'codesight.indexing.language': language,
        'codesight.indexing.file_extension': filePath.split('.').pop()
      }
    });
  }

  /**
   * Start a span for MCP tool operations
   */
  static startMcpToolSpan(
    toolName: string,
    parameters: Record<string, any>
  ): Span {
    return this.tracer.startSpan('codesight.mcp_tool', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'codesight.operation.type': 'mcp_tool',
        'codesight.mcp_tool.name': toolName,
        'codesight.mcp_tool.parameter_count': Object.keys(parameters).length,
        ...Object.fromEntries(
          Object.entries(parameters).map(([key, value]) => [
            `codesight.mcp_tool.parameter.${key}`,
            typeof value === 'string' ? value : JSON.stringify(value)
          ])
        )
      }
    });
  }

  /**
   * Start a span for database operations
   */
  static startDatabaseSpan(
    operation: string,
    table: string,
    query?: string
  ): Span {
    return this.tracer.startSpan('codesight.database', {
      kind: SpanKind.CLIENT,
      attributes: {
        'codesight.operation.type': 'database',
        'db.system': 'sqlite',
        'db.operation': operation,
        'db.sql.table': table,
        ...(query && { 'db.statement': query })
      }
    });
  }

  /**
   * Start a span for Rust FFI operations
   */
  static startRustFFISpan(
    functionName: string,
    parameters?: Record<string, any>
  ): Span {
    return this.tracer.startSpan('codesight.rust_ffi', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'codesight.operation.type': 'rust_ffi',
        'codesight.rust_ffi.function': functionName,
        'codesight.rust_ffi.parameter_count': parameters ? Object.keys(parameters).length : 0
      }
    });
  }

  /**
   * Add error information to a span
   */
  static recordError(span: Span, error: Error): void {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });

    // Add error attributes
    span.setAttribute('error.type', error.constructor.name);
    span.setAttribute('error.message', error.message);
    span.setAttribute('error.stack', error.stack || '');
  }

  /**
   * Add success information to a span
   */
  static recordSuccess(span: Span, result?: any): void {
    span.setStatus({ code: SpanStatusCode.OK });

    if (result) {
      span.setAttribute('codesight.operation.result_type', typeof result);

      if (typeof result === 'object' && result !== null) {
        span.setAttribute('codesight.operation.result_size', JSON.stringify(result).length);

        // Add specific result attributes based on operation type
        if (Array.isArray(result)) {
          span.setAttribute('codesight.operation.result_count', result.length);
        }
      }
    }
  }

  /**
   * Add performance metrics to a span
   */
  static recordPerformance(span: Span, metrics: {
    duration?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    resultCount?: number;
  }): void {
    if (metrics.duration) {
      span.setAttribute('codesight.performance.duration_ms', metrics.duration);
    }

    if (metrics.memoryUsage) {
      span.setAttribute('codesight.performance.memory_bytes', metrics.memoryUsage);
    }

    if (metrics.cpuUsage) {
      span.setAttribute('codesight.performance.cpu_percent', metrics.cpuUsage);
    }

    if (metrics.resultCount !== undefined) {
      span.setAttribute('codesight.performance.result_count', metrics.resultCount);
    }
  }

  /**
   * Create a child span
   */
  static createChildSpan(parent: Span, name: string, kind: SpanKind = SpanKind.INTERNAL): Span {
    return this.tracer.startSpan(name, {
      kind,
      parent: parent
    });
  }

  /**
   * Wrap a function with tracing
   */
  static async traceAsync<T>(
    spanName: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    const span = this.tracer.startSpan(spanName, { attributes });

    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return await fn(span);
      });

      this.recordSuccess(span, result);
      return result;
    } catch (error) {
      this.recordError(span, error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Wrap a synchronous function with tracing
   */
  static trace<T>(
    spanName: string,
    fn: (span: Span) => T,
    attributes?: Record<string, any>
  ): T {
    const span = this.tracer.startSpan(spanName, { attributes });

    try {
      const result = context.with(trace.setSpan(context.active(), span), () => {
        return fn(span);
      });

      this.recordSuccess(span, result);
      return result;
    } catch (error) {
      this.recordError(span, error as Error);
      throw error;
    } finally {
      span.end();
    }
  }
}

/**
 * Express middleware for automatic tracing
 */
export function tracingMiddleware() {
  return (req: any, res: any, next: any) => {
    const span = TracingUtils.startHttpSpan(
      `${req.method} ${req.path}`,
      req.method,
      req.url,
      req.headers
    );

    // Add span to request for later use
    req.span = span;

    // Set up response handling
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      span.setAttribute('http.status_code', res.statusCode);

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      return originalEnd.apply(this, args);
    };

    // Continue with request
    next();
  };
}

/**
 * Decorator for automatically tracing class methods
 */
export function traceable(operationName?: string, attributes?: Record<string, any>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const name = operationName || `${target.constructor.name}.${propertyKey}`;
      const span = TracingUtils.tracer.startSpan(name, {
        attributes: {
          'codesight.class': target.constructor.name,
          'codesight.method': propertyKey,
          'codesight.method.args_count': args.length,
          ...attributes
        }
      });

      try {
        const result = await context.with(trace.setSpan(context.active(), span), async () => {
          return await originalMethod.apply(this, args);
        });

        TracingUtils.recordSuccess(span, result);
        return result;
      } catch (error) {
        TracingUtils.recordError(span, error as Error);
        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}

/**
 * Generate a unique instance ID
 */
function generateInstanceId(): string {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current active span
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getSpan(context.active());
}

/**
 * Add custom attributes to current span
 */
export function addSpanAttributes(attributes: Record<string, any>): void {
  const span = getCurrentSpan();
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }
}

/**
 * Add event to current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, any>): void {
  const span = getCurrentSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set current span as failed
 */
export function setSpanError(error: Error): void {
  const span = getCurrentSpan();
  if (span) {
    TracingUtils.recordError(span, error);
  }
}

/**
 * Default tracing configuration for development
 */
export const defaultTracingConfig: TracingConfig = {
  serviceName: 'codesight-mcp-server',
  serviceVersion: '0.1.0',
  environment: 'development',
  console: true,
  batch: false, // Immediate export in development
  loggerInstrumentation: true
};

/**
 * Default tracing configuration for production
 */
export const productionTracingConfig: TracingConfig = {
  serviceName: 'codesight-mcp-server',
  serviceVersion: '0.1.0',
  environment: 'production',
  console: false,
  batch: true,
  batchSize: 512,
  batchDelayMs: 5000,
  batchTimeoutMs: 30000,
  sampler: {
    type: 'traceidratio',
    ratio: 0.1 // Sample 10% of traces in production
  },
  loggerInstrumentation: false // Disable in production for performance
};