/**
 * OpenTelemetry Tracing Setup for CodeSight MCP Server
 * Provides comprehensive distributed tracing capabilities
 *
 * TEMPORARILY DISABLED - Rule 15: Monitoring features reserved for Phase 4 implementation
 */

// import { NodeSDK } from '@opentelemetry/sdk-node';
// import { Resource } from '@opentelemetry/resources';
// import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
// import {
//   SimpleSpanProcessor,
//   BatchSpanProcessor,
//   ConsoleSpanExporter
// } from '@opentelemetry/sdk-trace-node';
// import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
// import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
// import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
// import { trace, SpanKind, SpanStatusCode, context, Span } from '@opentelemetry/api';

// Global tracer provider
// let tracerProvider: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry tracing
 * TEMPORARILY DISABLED - Rule 15: Monitoring features reserved for Phase 4 implementation
 */
// export function initializeTracing(config: TracingConfig): void {
//   // Implementation will be added in Phase 4
//   console.log('OpenTelemetry tracing temporarily disabled - Phase 4 implementation');
// }

/**
 * Create a new span for search operations
 * TEMPORARILY DISABLED
 */
// export function createSearchSpan(query: string, codebaseId: string, operationType: string): Span {
//   // Implementation will be added in Phase 4
//   console.log('Search span creation temporarily disabled - Phase 4 implementation');
//   return {} as Span;
// }

/**
 * Tracing utilities class
 * TEMPORARILY DISABLED
 */
// export class TracingUtils {
//   // Implementation will be added in Phase 4
//   static recordSuccess(_span: Span, _attributes?: Record<string, any>): void {
//     console.log('Tracing success recording temporarily disabled - Phase 4 implementation');
//   }
//
//   static recordError(_span: Span, _error: Error, _attributes?: Record<string, any>): void {
//     console.log('Tracing error recording temporarily disabled - Phase 4 implementation');
//   }
//
//   static addAttributes(_span: Span, _attributes: Record<string, any>): void {
//     console.log('Tracing attributes addition temporarily disabled - Phase 4 implementation');
//   }
//
//   static createChildSpan(_name: string, _parent: Span, _attributes?: Record<string, any>): Span {
//     console.log('Child span creation temporarily disabled - Phase 4 implementation');
//     return {} as Span;
//   }
//
//   static getTracer() {
//     console.log('Tracer access temporarily disabled - Phase 4 implementation');
//     return {} as any;
//   }
// }

/**
 * Decorator for automatic tracing
 * TEMPORARILY DISABLED
 */
// export function traceable(operationName: string, attributes?: Record<string, any>) {
//   return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
//     const originalMethod = descriptor.value;
//
//     descriptor.value = async function (...args: any[]) {
//       console.log(`Traceable decorator temporarily disabled for ${operationName} - Phase 4 implementation`);
//       return await originalMethod.apply(this, args);
//     };
//
//     return descriptor;
//   };
// }

// Export tracing configuration interface
export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaeger?: {
    endpoint: string;
  };
  zipkin?: {
    endpoint: string;
  };
  otlp?: {
    endpoint: string;
    headers?: Record<string, string>;
  };
  maxExportBatchSize?: number;
  scheduledDelayMillis?: number;
  maxTimeoutMillis?: number;
  exportTimeoutMillis?: number;
  samplingRatio?: number;
}

// Export tracing context utilities
export const TracingContext = {
  getCurrentSpan: () => {
    console.log('Tracing context access temporarily disabled - Phase 4 implementation');
    return null;
  },
  getTraceId: () => {
    console.log('Trace ID retrieval temporarily disabled - Phase 4 implementation');
    return null;
  },
  injectContext: (_headers: Record<string, string>) => {
    console.log('Context injection temporarily disabled - Phase 4 implementation');
    return _headers;
  },
  extractContext: (_headers: Record<string, string>) => {
    console.log('Context extraction temporarily disabled - Phase 4 implementation');
    return {};
  },
};