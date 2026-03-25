/**
 * Unit tests — Correlation ID utilities
 * Verifies ID generation uniqueness, prefix format, storage, and extraction.
 */

import { describe, it, expect } from 'vitest';
import {
  generateCorrelationId,
  setCorrelationId,
  getCorrelationId,
  clearCorrelationId,
  ensureCorrelationId,
  extractCorrelationId,
} from '@/lib/queue/observability/correlation';

describe('generateCorrelationId', () => {
  it('generates a string ID', () => {
    const id = generateCorrelationId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('uses the jq- prefix', () => {
    expect(generateCorrelationId()).toMatch(/^jq-/);
  });

  it('generates unique IDs', () => {
    const ids = Array.from({ length: 50 }, () => generateCorrelationId());
    const unique = new Set(ids);
    expect(unique.size).toBe(50);
  });
});

describe('correlation ID store', () => {
  const contextId = 'ctx-test-001';

  it('sets and gets a correlation ID', () => {
    setCorrelationId(contextId, 'jq-abc123');
    expect(getCorrelationId(contextId)).toBe('jq-abc123');
  });

  it('returns undefined for unknown context', () => {
    expect(getCorrelationId('ctx-unknown')).toBeUndefined();
  });

  it('clears a stored ID', () => {
    setCorrelationId(contextId, 'jq-to-delete');
    clearCorrelationId(contextId);
    expect(getCorrelationId(contextId)).toBeUndefined();
  });
});

describe('ensureCorrelationId', () => {
  it('creates a new ID when none exists', () => {
    const id = ensureCorrelationId('new-ctx');
    expect(id).toMatch(/^jq-/);
  });

  it('returns the existing ID on subsequent calls', () => {
    const ctx = 'persistent-ctx';
    const first = ensureCorrelationId(ctx);
    const second = ensureCorrelationId(ctx);
    expect(first).toBe(second);
  });
});

describe('extractCorrelationId', () => {
  it('prefers an explicit correlationId argument', () => {
    const id = extractCorrelationId({ correlationId: 'explicit-id' });
    expect(id).toBe('explicit-id');
  });

  it('falls back to header x-correlation-id', () => {
    const id = extractCorrelationId({
      headers: { 'x-correlation-id': 'header-id' },
    });
    expect(id).toBe('header-id');
  });

  it('falls back to data.correlationId', () => {
    const id = extractCorrelationId({
      data: { correlationId: 'data-id' },
    });
    expect(id).toBe('data-id');
  });

  it('generates a new ID when nothing is provided', () => {
    const id = extractCorrelationId({});
    expect(id).toMatch(/^jq-/);
  });

  it('explicit takes priority over header', () => {
    const id = extractCorrelationId({
      correlationId: 'explicit',
      headers: { 'x-correlation-id': 'header' },
    });
    expect(id).toBe('explicit');
  });
});
