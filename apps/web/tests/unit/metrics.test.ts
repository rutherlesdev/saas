/**
 * Unit tests — MetricsCollector
 * Tests processing time recording, percentile calculation, and singleton behaviour.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector, getMetricsCollector } from '@/lib/queue/observability/metrics';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('starts with zero records', () => {
    const m = collector.getMetrics();
    expect(m.totalRecords).toBe(0);
    expect(m.averageTime).toBe(0);
    expect(m.p50).toBe(0);
    expect(m.p95).toBe(0);
    expect(m.p99).toBe(0);
  });

  it('records and calculates average processing time', () => {
    collector.recordJobProcessingTime('job-1', 100);
    collector.recordJobProcessingTime('job-2', 200);
    collector.recordJobProcessingTime('job-3', 300);

    const m = collector.getMetrics();
    expect(m.totalRecords).toBe(3);
    expect(m.averageTime).toBe(200);
  });

  it('calculates p50 percentile correctly', () => {
    // Insert 10 sorted records: 100, 200, ..., 1000
    for (let i = 1; i <= 10; i++) {
      collector.recordJobProcessingTime(`job-${i}`, i * 100);
    }
    const p50 = collector.calculatePercentile(50);
    // p50 of [100..1000] (10 values): index ceil(50/100 * 10) - 1 = 4 → 500
    expect(p50).toBe(500);
  });

  it('calculates p95 percentile for 100 records', () => {
    for (let i = 1; i <= 100; i++) {
      collector.recordJobProcessingTime(`job-${i}`, i);
    }
    const p95 = collector.calculatePercentile(95);
    expect(p95).toBeGreaterThanOrEqual(95);
  });

  it('calculates p99 percentile for 100 records', () => {
    for (let i = 1; i <= 100; i++) {
      collector.recordJobProcessingTime(`job-${i}`, i);
    }
    const p99 = collector.calculatePercentile(99);
    expect(p99).toBeGreaterThanOrEqual(99);
  });

  it('resets all records', () => {
    collector.recordJobProcessingTime('job-1', 100);
    collector.reset();
    const m = collector.getMetrics();
    expect(m.totalRecords).toBe(0);
    expect(m.averageTime).toBe(0);
  });

  it('caps records at maxRecords to prevent memory bloat', () => {
    for (let i = 0; i < 10_001; i++) {
      collector.recordJobProcessingTime(`job-${i}`, i);
    }
    expect(collector.getMetrics().totalRecords).toBe(10_000);
  });
});

describe('getMetricsCollector singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = getMetricsCollector();
    const b = getMetricsCollector();
    expect(a).toBe(b);
  });
});
