/**
 * WhatsApp Connect Worker
 *
 * Processes post-connection/disconnection side-effects asynchronously:
 * records the event in the audit trail, verifies credentials on connect,
 * and emits observability metrics.
 */

import { Job } from 'bullmq';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { WhatsAppConnectJobData, WhatsAppConnectJobResult, JobEventType } from '../jobs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { bindAgentToChannel } from '@/lib/openclaw/agents';
import { createContextLogger } from '../observability/logger';
import { recordJobMetricOpenTelemetry } from '../observability/metrics';
import { withSpan } from '@/lib/observability/tracing';

/**
 * WhatsApp connect/disconnect job processor
 */
export async function processWhatsAppConnectJob(
  job: Job<WhatsAppConnectJobData>
): Promise<WhatsAppConnectJobResult> {
  const logger = createContextLogger({
    correlationId: job.data.correlationId || job.id!,
    jobId: job.id!,
    queueName: job.queueName,
  });

  const startTime = Date.now();
  const { userId, accountName, event } = job.data;

  return withSpan('queue.whatsapp_connect', async (span) => {
    span.setAttribute('whatsapp.user_id', userId);
    span.setAttribute('whatsapp.account_name', accountName);
    span.setAttribute('whatsapp.event', event);

    try {
      logger.info({ userId, accountName, event }, 'Starting WhatsApp connect job');

      if (event === 'connected') {
        await verifyCredentials(accountName, logger);
        await bindReadyAgentsToWhatsApp(userId, accountName, logger);
      }

      const processingTime = Date.now() - startTime;

      // Update job record
      await supabaseAdmin
        .from('jobs')
        .update({
          status: 'completed',
          result: { accountName, event, recordedAt: Date.now() },
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      recordJobMetricOpenTelemetry('whatsapp_connect', 'success', processingTime, { event });

      await recordJobEvent(
        job.id!,
        JobEventType.COMPLETED,
        { userId, accountName, event },
        job.data.correlationId || job.id!
      );

      logger.info({ userId, accountName, event, processingTime }, 'WhatsApp connect job completed');

      return { accountName, event, recordedAt: Date.now() };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(
        { userId, accountName, event, error: errorMessage },
        'WhatsApp connect job failed'
      );

      recordJobMetricOpenTelemetry('whatsapp_connect', 'failure', processingTime, { event, error: errorMessage });

      await supabaseAdmin
        .from('jobs')
        .update({
          status: job.attemptsMade + 1 >= (job.opts.attempts || 3) ? 'failed' : 'queued',
          error: { message: errorMessage, code: 'WHATSAPP_CONNECT_FAILED', attemptNumber: job.attemptsMade + 1 },
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      await recordJobEvent(
        job.id!,
        job.attemptsMade + 1 >= (job.opts.attempts || 3) ? JobEventType.FAILED : JobEventType.RETRYING,
        { error: errorMessage, attempt: job.attemptsMade + 1 },
        job.data.correlationId || job.id!
      );

      throw error;
    }
  });
}

async function bindReadyAgentsToWhatsApp(
  userId: string,
  accountName: string,
  logger: ReturnType<typeof createContextLogger>
) {
  const { data: agents, error } = await supabaseAdmin
    .from('agents')
    .select('openclaw_agent_id, name')
    .eq('user_id', userId)
    .eq('status', 'ready');

  if (error) {
    logger.warn({ error: error.message }, 'Could not fetch agents to bind to WhatsApp');
    return;
  }

  for (const agent of agents ?? []) {
    if (!agent.openclaw_agent_id) continue;
    try {
      await bindAgentToChannel(agent.openclaw_agent_id, 'whatsapp', accountName);
      logger.info(
        { agentId: agent.openclaw_agent_id, name: agent.name, accountName },
        'Agent bound to WhatsApp on connect'
      );
    } catch (bindError) {
      logger.warn(
        { agentId: agent.openclaw_agent_id, error: bindError instanceof Error ? bindError.message : String(bindError) },
        'Failed to bind agent to WhatsApp'
      );
    }
  }
}

async function verifyCredentials(accountName: string, logger: ReturnType<typeof createContextLogger>) {
  const credsPath = join(homedir(), '.openclaw', 'credentials', 'whatsapp', accountName, 'creds.json');
  try {
    await access(credsPath);
    logger.info({ accountName, credsPath }, 'WhatsApp credentials verified');
  } catch {
    logger.warn({ accountName, credsPath }, 'WhatsApp credentials file not found after connection');
  }
}

async function recordJobEvent(
  jobId: string,
  eventType: JobEventType,
  data: Record<string, unknown>,
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
