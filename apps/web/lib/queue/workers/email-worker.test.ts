/**
 * Email Worker Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Job } from 'bullmq';
import { processEmailJob } from '@/lib/queue/workers/email-worker';
import { EmailJobData } from '@/lib/queue/jobs';

// Mock dependencies
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

describe('Email Worker', () => {
  it('should process email successfully', async () => {
    const mockJob = {
      id: 'job-123',
      data: {
        to: 'test@example.com',
        subject: 'Test Email',
        templateId: 'welcome',
      } as EmailJobData,
      queueName: 'email-queue',
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as any;

    const result = await processEmailJob(mockJob);

    expect(result).toBeDefined();
    expect(result.messageId).toBeDefined();
    expect(result.sentAt).toBeDefined();
  });

  it('should handle job failure gracefully', async () => {
    const mockJob = {
      id: 'job-456',
      data: {
        to: 'invalid-email@',
        subject: 'Test',
        templateId: 'welcome',
      } as EmailJobData,
      queueName: 'email-queue',
      attemptsMade: 2,
      opts: { attempts: 3 },
    } as any;

    // The worker should attempt to send even with invalid email
    // and the actual error would come from the service
    const result = await processEmailJob(mockJob);
    expect(result).toBeDefined();
  });
});
