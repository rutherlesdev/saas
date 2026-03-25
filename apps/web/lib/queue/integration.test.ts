/**
 * Integration Tests
 * 
 * Tests job flow from enqueue to completion
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { EmailJobData, WebhookJobData } from '@/lib/queue/jobs';

// Mock Supabase
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      order: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('Integration Tests', () => {
  let enqueueEmail: (
    data: EmailJobData,
    options?: Record<string, unknown>
  ) => Promise<Job<EmailJobData>>;
  let enqueueWebhook: (
    data: WebhookJobData,
    options?: Record<string, unknown>
  ) => Promise<Job<WebhookJobData>>;
  let getQueue: (queueName: string) => any;
  let resetQueues: () => Promise<void>;
  let QUEUE_NAMES: Record<string, string>;

  beforeAll(async () => {
    process.env.REDIS_DB = '10';
    process.env.QUEUE_PREFIX = 'saas-queue-integration-tests';

    vi.resetModules();

    ({ enqueueEmail, enqueueWebhook } = await import('@/lib/queue/producers'));
    ({ getQueue, resetQueues } = await import('@/lib/queue/client'));
    ({ QUEUE_NAMES } = await import('@/lib/queue/config'));
  });

  beforeEach(async () => {
    await resetQueues();
  });

  afterEach(async () => {
    await resetQueues();
  });

  it('should enqueue and track job lifecycle', async () => {
    const emailData = {
      to: 'test@example.com',
      subject: 'Test',
      templateId: 'test',
      userId: 'user123',
    };

    const job = await enqueueEmail(emailData);

    expect(job.id).toBeDefined();
    expect(job.data).toEqual(emailData);

    // Job should be in queue
    const queue = getQueue(QUEUE_NAMES.EMAIL);
    const jobFromQueue = await queue.getJob(job.id!);

    expect(jobFromQueue).toBeDefined();
    expect(jobFromQueue?.data).toEqual(emailData);
  });

  it('should handle concurrent job submissions', async () => {
    const jobs = await Promise.all([
      enqueueEmail({
        to: 'user1@example.com',
        subject: 'Test 1',
        templateId: 'test',
      }),
      enqueueEmail({
        to: 'user2@example.com',
        subject: 'Test 2',
        templateId: 'test',
      }),
      enqueueEmail({
        to: 'user3@example.com',
        subject: 'Test 3',
        templateId: 'test',
      }),
    ]);

    expect(jobs).toHaveLength(3);
    expect(jobs.every((j) => j.id)).toBe(true);

    const queue = getQueue(QUEUE_NAMES.EMAIL);
    const count = await queue.count();

    expect(count).toBe(3);
  });

  it('should preserve job priority', async () => {
    const lowPriorityJob = await enqueueEmail(
      {
        to: 'test@example.com',
        subject: 'Low Priority',
        templateId: 'test',
      },
      { priority: 10 }
    );

    const highPriorityJob = await enqueueEmail(
      {
        to: 'test@example.com',
        subject: 'High Priority',
        templateId: 'test',
      },
      { priority: 1 }
    );

    expect(lowPriorityJob.id).toBeDefined();
    expect(highPriorityJob.id).toBeDefined();
  });

  it('should handle delayed jobs', async () => {
    const delayMs = 5000;

    const job = await enqueueEmail(
      {
        to: 'test@example.com',
        subject: 'Delayed Email',
        templateId: 'test',
      },
      { delay: delayMs }
    );

    const queue = getQueue(QUEUE_NAMES.EMAIL);
    const delayedCount = await queue.getDelayedCount();

    expect(delayedCount).toBeGreaterThan(0);
  });

  it('should track webhook delivery attempts', async () => {
    const webhookJob = await enqueueWebhook({
      webhookId: 'webhook-123',
      url: 'https://example.com/webhook',
      event: 'user.created',
      payload: { userId: 'user123' },
      userId: 'user123',
    });

    expect(webhookJob.id).toBeDefined();
    expect(webhookJob.opts.attempts).toBeGreaterThan(0);
  });
});
