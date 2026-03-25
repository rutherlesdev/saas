/**
 * Integration tests — health and metrics API routes
 * Routes work correctly when queue/health modules are mocked.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/queue/health', () => ({
  getSystemHealth: vi.fn().mockResolvedValue({
    status: 'healthy',
    redis: { status: 'connected', latency: 1 },
    queues: {},
    timestamp: Date.now(),
  }),
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

import { GET as healthGET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns a 200 with healthy status', async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.redis).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });
});
