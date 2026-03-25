/**
 * Job Producers Tests
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import type { Job } from 'bullmq';
import type {
  EmailJobData,
  FileProcessingJobData,
  WebhookJobData,
} from '@/lib/queue/jobs';

// Mock Supabase
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    })),
  },
}));

describe('Job Producers', () => {
  let enqueueEmail: (
    data: EmailJobData,
    options?: Record<string, unknown>
  ) => Promise<Job<EmailJobData>>;
  let enqueueFileProcessing: (
    data: FileProcessingJobData,
    options?: Record<string, unknown>
  ) => Promise<Job<FileProcessingJobData>>;
  let enqueueWebhook: (
    data: WebhookJobData,
    options?: Record<string, unknown>
  ) => Promise<Job<WebhookJobData>>;
  let resetQueues: () => Promise<void>;

  beforeAll(async () => {
    process.env.REDIS_DB = '11';
    process.env.QUEUE_PREFIX = 'saas-queue-producers-tests';

    vi.resetModules();

    ({ enqueueEmail, enqueueFileProcessing, enqueueWebhook } = await import(
      '@/lib/queue/producers'
    ));
    ({ resetQueues } = await import('@/lib/queue/client'));
  });

  beforeEach(async () => {
    await resetQueues();
  });

  afterEach(async () => {
    await resetQueues();
  });

  it('should enqueue email job with valid data', async () => {
    const emailData = {
      to: 'test@example.com',
      subject: 'Test Email',
      templateId: 'welcome',
      userId: 'user123',
    };

    const job = await enqueueEmail(emailData);

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.data.to).toBe(emailData.to);
  });

  it('should reject email job with invalid email', async () => {
    const invalidData = {
      to: 'not-an-email',
      subject: 'Test',
      templateId: 'welcome',
    };

    await expect(enqueueEmail(invalidData)).rejects.toThrow();
  });

  it('should enqueue file processing job', async () => {
    const fileData = {
      fileId: 'file123',
      userId: 'user123',
      bucket: 'uploads',
      path: 'file.pdf',
      mimeType: 'application/pdf',
      processType: 'extract' as const,
    };

    const job = await enqueueFileProcessing(fileData);

    expect(job).toBeDefined();
    expect(job.data.fileId).toBe(fileData.fileId);
  });

  it('should handle idempotency key', async () => {
    const emailData = {
      to: 'test@example.com',
      subject: 'Test',
      templateId: 'welcome',
    };

    const key = 'idempotency-key-123';

    const job1 = await enqueueEmail(emailData, { idempotencyKey: key });
    const job2 = await enqueueEmail(emailData, { idempotencyKey: key });

    // Second call should return same job
    expect(job1.id).toBe(job2.id);
  });

  it('should enqueue webhook job', async () => {
    const webhookData = {
      webhookId: 'webhook123',
      url: 'https://example.com/webhook',
      event: 'user.created',
      payload: { userId: 'user123' },
      userId: 'user123',
    };

    const job = await enqueueWebhook(webhookData);

    expect(job).toBeDefined();
    expect(job.data.webhookId).toBe(webhookData.webhookId);
  });

  it('should set correlation ID', async () => {
    const correlationId = 'corr-123';

    const job = await enqueueEmail(
      {
        to: 'test@example.com',
        subject: 'Test',
        templateId: 'welcome',
      },
      { correlationId }
    );

    expect(job).toBeDefined();
  });
});
