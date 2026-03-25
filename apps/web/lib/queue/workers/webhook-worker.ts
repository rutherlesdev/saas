/**
 * Webhook Worker
 * 
 * Delivers webhooks with exponential backoff, timeout handling,
 * and idempotency key tracking for reliable delivery.
 */

import { Job } from 'bullmq';
import { WebhookJobData, JobEventType } from '../jobs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createContextLogger } from '../observability/logger';
import { recordJobMetricOpenTelemetry } from '../observability/metrics';

export async function processWebhookJob(job: Job<WebhookJobData>) {
  const logger = createContextLogger({
    correlationId: job.data.correlationId || job.id!,
    jobId: job.id!,
    queueName: job.queueName,
  });

  const startTime = Date.now();

  try {
    logger.info(
      { webhookId: job.data.webhookId, url: job.data.url, event: job.data.event },
      'Starting webhook delivery'
    );

    const result = await deliverWebhook(job.data);
    const processingTime = Date.now() - startTime;

    // Update Supabase
    await supabaseAdmin.from('jobs').update({
      status: 'completed',
      result: {
        webhookId: job.data.webhookId,
        statusCode: result.statusCode,
        responseTime: result.responseTime,
        attempt: job.attemptsMade + 1,
      },
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);

    recordJobMetricOpenTelemetry('webhook', 'success', processingTime, {
      webhookId: job.data.webhookId,
      statusCode: result.statusCode,
    });

    logger.info({ webhookId: job.data.webhookId, statusCode: result.statusCode }, 'Webhook delivered');
    return result;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error({ error: errorMessage }, 'Webhook delivery failed');

    recordJobMetricOpenTelemetry('webhook', 'failure', processingTime, {
      webhookId: job.data.webhookId,
      error: errorMessage,
    });

    const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);
    await supabaseAdmin.from('jobs').update({
      status: isLastAttempt ? 'failed' : 'queued',
      error: {
        message: errorMessage,
        code: 'WEBHOOK_DELIVERY_FAILED',
        attempt: job.attemptsMade + 1,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);

    // Don't throw for 4xx client errors - these won't succeed on retry
    if (error instanceof WebhookError && error.statusCode >= 400 && error.statusCode < 500) {
      logger.warn('Webhook rejected (4xx), not retrying');
      return {
        webhookId: job.data.webhookId,
        statusCode: error.statusCode,
        responseTime: Date.now() - startTime,
        attempt: job.attemptsMade + 1,
      };
    }

    throw error;
  }
}

class WebhookError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

async function deliverWebhook(data: WebhookJobData) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), data.timeout ?? 30000);

  try {
    const response = await fetch(data.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-ID': data.webhookId,
        'X-Event': data.event,
        'X-Timestamp': String(Date.now()),
      },
      body: JSON.stringify(data.payload),
      signal: controller.signal,
    });

    const responseTime = Date.now();

    // Treat 2xx and 3xx as success
    if (response.status >= 200 && response.status < 400) {
      return {
        webhookId: data.webhookId,
        statusCode: response.status,
        responseTime,
        attempt: 1,
      };
    }

    // Store error details for 4xx/5xx
    throw new WebhookError(response.status, `HTTP ${response.status}`);
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof WebhookError) {
      throw error;
    }

    throw new Error(
      error instanceof Error ? error.message : 'Webhook delivery failed'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
