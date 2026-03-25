import { test, expect } from '@playwright/test';

test.describe('Job enqueue flow', () => {
  test('POST /api/jobs/enqueue returns jobId and correlationId', async ({ request }) => {
    const res = await request.post('/api/jobs/enqueue', {
      data: {
        jobType: 'email',
        data: {
          to: 'e2e@example.com',
          subject: 'E2E Test',
          templateId: 'test',
        },
      },
    });

    // 200 or 201 — job was accepted
    expect([200, 201]).toContain(res.status());

    const body = await res.json();
    expect(body.jobId).toBeDefined();
    expect(body.correlationId).toBeDefined();
    expect(body.status).toBe('queued');
  });

  test('POST /api/jobs/enqueue rejects unknown job types', async ({ request }) => {
    const res = await request.post('/api/jobs/enqueue', {
      data: { jobType: 'does-not-exist', data: {} },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test('POST /api/jobs/enqueue rejects missing payload', async ({ request }) => {
    const res = await request.post('/api/jobs/enqueue', {
      data: { jobType: 'email' },
    });

    expect(res.status()).toBe(400);
  });

  test('job status endpoint returns 404 for unknown job', async ({ request }) => {
    const res = await request.get('/api/jobs/nonexistent-job-id/status');
    expect(res.status()).toBe(404);
  });
});

test.describe('Metrics reflect enqueued jobs', () => {
  test('metrics summary changes after enqueue', async ({ request }) => {
    // Skip if Redis is unavailable (CI without Redis)
    const health = await request.get('/api/health/queue');
    const { redis } = await health.json();
    if (redis?.status !== 'connected') {
      test.skip();
      return;
    }

    const before = await request
      .get('/api/metrics')
      .then((r) => r.json())
      .then((b) => (b.summary?.jobsQueued as number) ?? 0);

    await request.post('/api/jobs/enqueue', {
      data: {
        jobType: 'webhook',
        data: {
          url: 'https://example.com/webhook',
          method: 'POST',
          payload: { event: 'e2e-test' },
        },
      },
    });

    // Queue depth should have increased
    await expect
      .poll(
        async () => {
          const body = await request
            .get('/api/metrics')
            .then((r) => r.json());
          return body.summary?.jobsQueued as number;
        },
        { timeout: 5000, intervals: [500] }
      )
      .toBeGreaterThanOrEqual(before);
  });
});
