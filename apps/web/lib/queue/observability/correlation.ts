/**
 * Correlation ID Management
 * 
 * Generates and tracks correlation IDs across job lifecycle
 * for distributed tracing and debugging.
 */

import { nanoid } from 'nanoid';

// Thread-local storage for correlation ID
const correlationIdMap = new Map<string, string>();

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return `jq-${nanoid(12)}`;
}

/**
 * Store correlation ID for async context
 */
export function setCorrelationId(contextId: string, correlationId: string) {
  correlationIdMap.set(contextId, correlationId);
}

/**
 * Retrieve stored correlation ID
 */
export function getCorrelationId(contextId: string): string | undefined {
  return correlationIdMap.get(contextId);
}

/**
 * Clear correlation ID
 */
export function clearCorrelationId(contextId: string) {
  correlationIdMap.delete(contextId);
}

/**
 * Get or create correlation ID for a context
 */
export function ensureCorrelationId(contextId: string): string {
  let correlationId = getCorrelationId(contextId);
  
  if (!correlationId) {
    correlationId = generateCorrelationId();
    setCorrelationId(contextId, correlationId);
  }
  
  return correlationId;
}

/**
 * Extract correlation ID from job data or headers
 */
export function extractCorrelationId(input: {
  headers?: Record<string, string>;
  data?: Record<string, any>;
  correlationId?: string;
}): string {
  // Priority: explicit > header > data > generate
  if (input.correlationId) return input.correlationId;
  
  if (input.headers?.['x-correlation-id']) {
    return input.headers['x-correlation-id'];
  }
  
  if (input.data?.correlationId) {
    return input.data.correlationId;
  }
  
  return generateCorrelationId();
}
