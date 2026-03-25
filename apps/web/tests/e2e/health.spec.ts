import { test, expect } from '@playwright/test';

test.describe('Health endpoints', () => {
  test('GET /api/health returns a valid status', async ({ request }) => {
    const res = await request.get('/api/health');

    // Accept healthy (200) or degraded (503) — both are valid shapes
    expect([200, 503]).toContain(res.status());

    const body = await res.json();
    expect(body.status).toMatch(/^(healthy|degraded|unhealthy)$/);
    expect(body.timestamp).toBeDefined();
  });

  test('GET /api/health/queue returns redis and queue info', async ({ request }) => {
    const res = await request.get('/api/health/queue');

    expect([200, 503]).toContain(res.status());

    const body = await res.json();
    expect(body.status).toMatch(/^(ok|error)$/);
    expect(body.timestamp).toBeDefined();
    expect(body.redis).toBeDefined();
    expect(body.redis.status).toMatch(/^(connected|disconnected)$/);
  });

  test('GET /api/metrics returns metrics shape', async ({ request }) => {
    const res = await request.get('/api/metrics');

    // The endpoint should always respond even if Redis is down
    expect(res.status()).toBeLessThan(500);

    const body = await res.json();
    expect(body.timestamp).toBeDefined();
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.jobsQueued).toBe('number');
    expect(typeof body.summary.jobsRunning).toBe('number');
    expect(typeof body.summary.jobsFailed).toBe('number');
  });

  test('GET /api/queue/metrics returns processing stats', async ({ request }) => {
    const res = await request.get('/api/queue/metrics');

    expect(res.status()).toBeLessThan(500);

    const body = await res.json();
    expect(body.timestamp).toBeDefined();
    expect(body.processing).toBeDefined();
  });
});
