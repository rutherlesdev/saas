/**
 * Integration tests — /api/health/queue and /api/metrics routes
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/queue/health', () => ({
  checkRedisHealth: vi.fn().mockResolvedValue({ status: 'connected', latency: 1 }),
  getQueueHealth: vi.fn().mockResolvedValue({
    depth: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    paused: false,
  }),
}));

vi.mock('@/lib/queue/client', () => ({
  getRedisConnection: vi.fn(),
  getQueue: vi.fn(() => ({
    count: vi.fn().mockResolvedValue(0),
    getActiveCount: vi.fn().mockResolvedValue(0),
    getDelayedCount: vi.fn().mockResolvedValue(0),
    getFailedCount: vi.fn().mockResolvedValue(0),
    isPaused: vi.fn().mockResolvedValue(false),
  })),
}));

import { GET as queueHealthGET } from '@/app/api/health/queue/route';
import { GET as metricsGET } from '@/app/api/metrics/route';

describe('GET /api/health/queue', () => {
  it('returns 200 with redis and queue info', async () => {
    const res = await queueHealthGET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.redis).toBeDefined();
    expect(body.redis.status).toBe('connected');
    expect(body.queues).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });
});

describe('GET /api/metrics', () => {
  it('returns 200 with full metrics shape', async () => {
    const res = await metricsGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.timestamp).toBeDefined();
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.jobsQueued).toBe('number');
    expect(typeof body.summary.jobsRunning).toBe('number');
    expect(typeof body.summary.jobsFailed).toBe('number');
    expect(body.queues).toBeDefined();
    expect(body.processing).toBeDefined();
  });
});
