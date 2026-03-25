/**
 * Job Producers
 * 
 * Factory functions to enqueue jobs with proper validation,
 * idempotency handling, and correlation ID tracking.
 */

import { Queue, Job } from 'bullmq';
import { getQueue } from './client';
import { QUEUE_NAMES, QUEUE_CONFIG } from './config';
import {
  EmailJobData,
  FileProcessingJobData,
  DataExportJobData,
  WebhookJobData,
  CleanupJobData,
  validateJobData,
  EmailJobDataSchema,
  FileProcessingJobDataSchema,
  DataExportJobDataSchema,
  WebhookJobDataSchema,
  CleanupJobDataSchema,
} from './jobs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateCorrelationId } from './observability/correlation';
import { getLogger } from './observability/logger';

interface EnqueueOptions {
  correlationId?: string;
  idempotencyKey?: string;
  delay?: number;
  priority?: number;
  attempts?: number;
}

/**
 * Store job metadata in Supabase for audit trail
 */
async function recordJobInSupabase(
  jobId: string,
  queueName: string,
  jobType: string,
  data: Record<string, any>,
  userId: string | undefined,
  correlationId: string,
  idempotencyKey?: string
) {
  try {
    const { error } = await supabaseAdmin
      .from('jobs')
      .insert({
        id: jobId,
        queue_name: queueName,
        job_type: jobType,
        user_id: userId,
        status: 'queued',
        data,
        attempt_count: 0,
        max_attempts: QUEUE_CONFIG.maxAttempts,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        correlation_id: correlationId,
        idempotency_key: idempotencyKey,
      });

    if (error) {
      console.error('Failed to record job in Supabase:', error);
    }
  } catch (error) {
    console.error('Error recording job metadata:', error);
  }
}

/**
 * Check idempotency - if same key exists, return existing job
 */
async function checkIdempotency(
  idempotencyKey: string,
  queueName: string
): Promise<Job | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .eq('queue_name', queueName)
      .limit(1)
      .single();

    if (!error && data) {
      // Return existing job to caller
      const queue = getQueue(queueName as any);
      return queue.getJob(data.id);
    }
  } catch (error) {
    // Error is expected if job doesn't exist
  }

  return null;
}

/**
 * Enqueue email job
 */
export async function enqueueEmail(
  data: EmailJobData,
  options?: EnqueueOptions
): Promise<Job<EmailJobData>> {
  if (!validateJobData('email', data)) {
    throw new Error('Invalid email job data');
  }

  const queue = getQueue(QUEUE_NAMES.EMAIL);
  const correlationId = options?.correlationId || generateCorrelationId();

  // Check idempotency
  if (options?.idempotencyKey) {
    const existingJob = await checkIdempotency(
      options.idempotencyKey,
      QUEUE_NAMES.EMAIL
    );
    if (existingJob) {
      getLogger().info({
        msg: 'Job already exists (idempotent)',
        jobId: existingJob.id,
        correlationId,
      });
      return existingJob;
    }
  }

  const job = await queue.add('send-email', data, {
    attempts: options?.attempts || QUEUE_CONFIG.maxAttempts,
    backoff: {
      type: 'exponential',
      delay: QUEUE_CONFIG.initialDelay,
    },
    delay: options?.delay,
    priority: options?.priority,
    removeOnComplete: QUEUE_CONFIG.removeOnComplete,
    removeOnFail: QUEUE_CONFIG.removeOnFail,
  });

  await recordJobInSupabase(
    job.id!,
    QUEUE_NAMES.EMAIL,
    'email',
    data,
    data.userId,
    correlationId,
    options?.idempotencyKey
  );

  getLogger().info({
    msg: 'Email job enqueued',
    jobId: job.id,
    to: data.to,
    correlationId,
  });

  return job;
}

/**
 * Enqueue file processing job
 */
export async function enqueueFileProcessing(
  data: FileProcessingJobData,
  options?: EnqueueOptions
): Promise<Job<FileProcessingJobData>> {
  if (!validateJobData('file_processing', data)) {
    throw new Error('Invalid file processing job data');
  }

  const queue = getQueue(QUEUE_NAMES.FILE_PROCESSING);
  const correlationId = options?.correlationId || generateCorrelationId();

  if (options?.idempotencyKey) {
    const existingJob = await checkIdempotency(
      options.idempotencyKey,
      QUEUE_NAMES.FILE_PROCESSING
    );
    if (existingJob) {
      return existingJob;
    }
  }

  const job = await queue.add('process-file', data, {
    attempts: options?.attempts || QUEUE_CONFIG.maxAttempts,
    backoff: {
      type: 'exponential',
      delay: QUEUE_CONFIG.initialDelay,
    },
    delay: options?.delay,
    priority: options?.priority,
    removeOnComplete: QUEUE_CONFIG.removeOnComplete,
    removeOnFail: QUEUE_CONFIG.removeOnFail,
  });

  await recordJobInSupabase(
    job.id!,
    QUEUE_NAMES.FILE_PROCESSING,
    'file_processing',
    data,
    data.userId,
    correlationId,
    options?.idempotencyKey
  );

  return job;
}

/**
 * Enqueue data export job
 */
export async function enqueueDataExport(
  data: DataExportJobData,
  options?: EnqueueOptions
): Promise<Job<DataExportJobData>> {
  if (!validateJobData('data_export', data)) {
    throw new Error('Invalid data export job data');
  }

  const queue = getQueue(QUEUE_NAMES.DATA_EXPORT);
  const correlationId = options?.correlationId || generateCorrelationId();

  if (options?.idempotencyKey) {
    const existingJob = await checkIdempotency(
      options.idempotencyKey,
      QUEUE_NAMES.DATA_EXPORT
    );
    if (existingJob) {
      return existingJob;
    }
  }

  const job = await queue.add('export-data', data, {
    attempts: options?.attempts || 1, // No retries for exports
    delay: options?.delay,
    priority: options?.priority || 5, // Lower priority export
    removeOnComplete: QUEUE_CONFIG.removeOnComplete,
    removeOnFail: QUEUE_CONFIG.removeOnFail,
  });

  await recordJobInSupabase(
    job.id!,
    QUEUE_NAMES.DATA_EXPORT,
    'data_export',
    data,
    data.userId,
    correlationId,
    options?.idempotencyKey
  );

  return job;
}

/**
 * Enqueue webhook job
 */
export async function enqueueWebhook(
  data: WebhookJobData,
  options?: EnqueueOptions
): Promise<Job<WebhookJobData>> {
  if (!validateJobData('webhook', data)) {
    throw new Error('Invalid webhook job data');
  }

  const queue = getQueue(QUEUE_NAMES.WEBHOOK);
  const correlationId = options?.correlationId || generateCorrelationId();

  // Webhooks should be idempotent by default
  if (!options?.idempotencyKey) {
    options = {
      ...options,
      idempotencyKey: `webhook-${data.webhookId}-${Date.now()}`,
    };
  }

  const job = await queue.add('deliver-webhook', data, {
    attempts: options?.attempts || QUEUE_CONFIG.maxAttempts,
    backoff: {
      type: 'exponential',
      delay: QUEUE_CONFIG.initialDelay * 2, // Longer backoff for webhooks
    },
    delay: options?.delay,
    priority: options?.priority,
    removeOnComplete: QUEUE_CONFIG.removeOnComplete,
    removeOnFail: QUEUE_CONFIG.removeOnFail,
  });

  await recordJobInSupabase(
    job.id!,
    QUEUE_NAMES.WEBHOOK,
    'webhook',
    data,
    data.userId,
    correlationId,
    options?.idempotencyKey
  );

  return job;
}

/**
 * Enqueue cleanup job
 */
export async function enqueueCleanup(
  data: CleanupJobData,
  options?: EnqueueOptions
): Promise<Job<CleanupJobData>> {
  if (!validateJobData('cleanup', data)) {
    throw new Error('Invalid cleanup job data');
  }

  const queue = getQueue(QUEUE_NAMES.CLEANUP);
  const correlationId = options?.correlationId || generateCorrelationId();

  const job = await queue.add('cleanup', data, {
    attempts: 1,
    delay: options?.delay || 60000, // Delay cleanup by 1 minute
    priority: -10, // Very low priority
    repeat: {
      pattern: process.env.CLEANUP_CRON || '0 2 * * *', // 2 AM daily
    },
    removeOnComplete: false, // Keep history for cleanup jobs
    removeOnFail: false,
  });

  await recordJobInSupabase(
    job.id!,
    QUEUE_NAMES.CLEANUP,
    'cleanup',
    data,
    undefined,
    correlationId,
    options?.idempotencyKey
  );

  return job;
}
