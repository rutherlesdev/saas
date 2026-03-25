/**
 * Integration tests — /api/health/queue standalone (isolated mock scope)
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/queue/health', () => ({
  checkRedisHealth: vi.fn().mockResolvedValue({ status: 'connected', latency: 1 }),
  getQueueHealth: vi.fn().mockResolvedValue({ depth: 0, active: 0, delayed: 0, failed: 0, paused: false }),
}));
vi.mock('@/lib/queue/client', () => ({
  getRedisConnection: vi.fn(),
  getQueue: vi.fn(() => ({ count: vi.fn().mockResolvedValue(0), getActiveCount: vi.fn().mockResolvedValue(0), getDelayedCount: vi.fn().mockResolvedValue(0), getFailedCount: vi.fn().mockResolvedValue(0), isPaused: vi.fn().mockResolvedValue(false) })),
}));

import { GET as queueHealthGET } from '@/app/api/health/queue/route';

describe('GET /api/health/queue (isolated)', () => {
  it('returns 200 when Redis is healthy', async () => {
    const res = await queueHealthGET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.redis.status).toBe('connected');
  });
});
