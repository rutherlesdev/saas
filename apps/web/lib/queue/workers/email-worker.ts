/**
 * Email Worker
 * 
 * Processes email jobs: validates, sends via transactional email service,
 * and tracks delivery status.
 */

import { Job } from 'bullmq';
import { EmailJobData, JobEventType } from '../jobs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createContextLogger } from '../observability/logger';
import { recordJobMetricOpenTelemetry } from '../observability/metrics';

/**
 * Email job processor
 */
export async function processEmailJob(job: Job<EmailJobData>) {
  const logger = createContextLogger({
    correlationId: job.data.correlationId || job.id!,
    jobId: job.id!,
    queueName: job.queueName,
  });

  const startTime = Date.now();

  try {
    logger.info({ to: job.data.to, templateId: job.data.templateId }, 'Starting email job');

    // Simulate email sending (replace with actual email service)
    const messageId = await sendEmail(job.data);

    const processingTime = Date.now() - startTime;

    // Update job status in Supabase
    await supabaseAdmin
      .from('jobs')
      .update({
        status: 'completed',
        result: {
          messageId,
          sentAt: Date.now(),
          attemptCount: job.attemptsMade + 1,
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    // Record metrics
    recordJobMetricOpenTelemetry('email', 'success', processingTime, {
      to: job.data.to,
    });

    // Log event
    await recordJobEvent(
      job.id!,
      JobEventType.COMPLETED,
      {
        messageId,
        sentAt: Date.now(),
      },
      job.data.correlationId || job.id!
    );

    logger.info(
      { messageId, processingTime },
      'Email job completed successfully'
    );

    return { messageId, sentAt: Date.now() };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(
      { error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
      'Email job failed'
    );

    recordJobMetricOpenTelemetry('email', 'failure', processingTime, {
      to: job.data.to,
      error: errorMessage,
    });

    // Update job status
    await supabaseAdmin
      .from('jobs')
      .update({
        status: job.attemptsMade + 1 >= (job.opts.attempts || 3) ? 'failed' : 'queued',
        error: {
          message: errorMessage,
          code: 'EMAIL_SEND_FAILED',
          attemptNumber: job.attemptsMade + 1,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    // Record event
    await recordJobEvent(
      job.id!,
      job.attemptsMade + 1 >= (job.opts.attempts || 3)
        ? JobEventType.FAILED
        : JobEventType.RETRYING,
      {
        error: errorMessage,
        attempt: job.attemptsMade + 1,
      },
      job.data.correlationId || job.id!
    );

    throw error;
  }
}

/**
 * Simulate actual email sending
 * Replace with your email service (SendGrid, Mailgun, AWS SES, etc.)
 */
async function sendEmail(data: EmailJobData): Promise<string> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // In production, call your email service:
  // const response = await mailgunClient.messages.create({
  //   from: 'noreply@example.com',
  //   to: data.to,
  //   subject: data.subject,
  //   html: await renderTemplate(data.templateId, data.variables),
  // });
  // return response.id;

  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Record job event for audit trail
 */
async function recordJobEvent(
  jobId: string,
  eventType: JobEventType,
  data: Record<string, any>,
  correlationId: string
) {
  try {
    await supabaseAdmin.from('job_events').insert({
      job_id: jobId,
      event_type: eventType,
      data,
      correlation_id: correlationId,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to record job event:', error);
  }
}
