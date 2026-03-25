/**
 * OpenTelemetry Tracing Helpers
 *
 * Provides span utilities for manual instrumentation of
 * queue operations, API routes, and external calls.
 */

import {
  trace,
  SpanStatusCode,
  SpanKind,
  type Span,
  type Attributes,
} from '@opentelemetry/api';

export { SpanStatusCode, SpanKind, trace };

const tracer = trace.getTracer('saas-app', '1.0.0');

export function getTracer() {
  return tracer;
}

/**
 * Wrap an async operation in an OTEL span.
 * Sets OK/ERROR status automatically and records exceptions.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Attributes
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    if (attributes) span.setAttributes(attributes);
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      const error = err as Error;
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      throw err;
    } finally {
      span.end();
    }
  });
}
