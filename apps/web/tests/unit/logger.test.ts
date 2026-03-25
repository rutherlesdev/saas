/**
 * Unit tests — Pino logger helpers
 * Verifies singleton behaviour, child logger creation, and log context binding.
 */

import { describe, it, expect } from 'vitest';
import {
  getLogger,
  createContextLogger,
  logWithContext,
} from '@/lib/queue/observability/logger';

describe('getLogger', () => {
  it('returns a logger instance', () => {
    const logger = getLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('returns the same singleton on repeated calls', () => {
    const a = getLogger();
    const b = getLogger();
    expect(a).toBe(b);
  });
});

describe('createContextLogger', () => {
  it('creates a child logger with correlation context', () => {
    const log = createContextLogger({
      correlationId: 'test-corr-id',
      jobId: 'job-abc',
      queueName: 'email-queue',
    });
    expect(log).toBeDefined();
    expect(typeof log.info).toBe('function');
  });

  it('does not throw for minimal context', () => {
    expect(() =>
      createContextLogger({ correlationId: 'min-ctx' })
    ).not.toThrow();
  });
});

describe('logWithContext', () => {
  it('logs without throwing for all log levels', () => {
    const ctx = { correlationId: 'ctx-test', jobId: 'job-1' };
    expect(() => logWithContext(ctx, 'info', 'info message')).not.toThrow();
    expect(() => logWithContext(ctx, 'warn', 'warn message')).not.toThrow();
    expect(() => logWithContext(ctx, 'error', 'error message')).not.toThrow();
    expect(() => logWithContext(ctx, 'debug', 'debug message')).not.toThrow();
  });

  it('accepts extra data payload', () => {
    const ctx = { correlationId: 'ctx-ext' };
    expect(() =>
      logWithContext(ctx, 'info', 'with data', { extra: true, count: 5 })
    ).not.toThrow();
  });
});
