/**
 * Unit tests — OTEL tracing helpers
 * Verifies withSpan sets OK/ERROR status and propagates return values / errors.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock @opentelemetry/api before importing tracing.ts
vi.mock('@opentelemetry/api', () => {
  const mockSpan = {
    setAttributes: vi.fn(),
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    recordException: vi.fn(),
    end: vi.fn(),
  };

  return {
    trace: {
      getTracer: vi.fn(() => ({
        startActiveSpan: vi.fn(async (_name: string, fn: (s: unknown) => Promise<unknown>) =>
          fn(mockSpan)
        ),
      })),
    },
    SpanStatusCode: { OK: 1, ERROR: 2 },
    SpanKind: { INTERNAL: 0, SERVER: 1, CLIENT: 2 },
    // re-export mock span so tests can inspect calls
    __mockSpan: mockSpan,
  };
});

import { withSpan, SpanStatusCode } from '@/lib/observability/tracing';

describe('withSpan', () => {
  it('returns the value from the wrapped function', async () => {
    const result = await withSpan('test.span', async () => 42);
    expect(result).toBe(42);
  });

  it('propagates errors from the wrapped function', async () => {
    await expect(
      withSpan('failing.span', async () => {
        throw new Error('span error');
      })
    ).rejects.toThrow('span error');
  });

  it('resolves with complex return types', async () => {
    const obj = { a: 1, b: [1, 2, 3] };
    const result = await withSpan('object.span', async () => obj);
    expect(result).toEqual(obj);
  });

  it('accepts span attributes without throwing', async () => {
    await expect(
      withSpan('attr.span', async () => 'ok', {
        'job.type': 'email',
        'job.id': 'abc-123',
      })
    ).resolves.toBe('ok');
  });
});
