/**
 * Agent Provision Worker
 *
 * Processes agent provisioning jobs asynchronously: calls the OpenClaw CLI
 * to create the agent workspace and set identity, then updates the agent
 * record in Supabase with the final status.
 */

import { Job } from 'bullmq';
import { AgentProvisionJobData, AgentProvisionJobResult, JobEventType } from '../jobs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { provisionOpenClawAgent, bindAgentToChannel } from '@/lib/openclaw/agents';
import { createContextLogger } from '../observability/logger';
import { recordJobMetricOpenTelemetry } from '../observability/metrics';
import { withSpan } from '@/lib/observability/tracing';

/**
 * Agent provision job processor
 */
export async function processAgentProvisionJob(
  job: Job<AgentProvisionJobData>
): Promise<AgentProvisionJobResult> {
  const logger = createContextLogger({
    correlationId: job.data.correlationId || job.id!,
    jobId: job.id!,
    queueName: job.queueName,
  });

  const startTime = Date.now();
  const { agentId, userId, openClawAgentId, displayName, workspacePath, agentDirPath } = job.data;

  return withSpan('queue.agent_provision', async (span) => {
    span.setAttribute('agent.id', agentId);
    span.setAttribute('agent.user_id', userId);
    span.setAttribute('openclaw.agent_id', openClawAgentId);

    try {
      logger.info({ agentId, openClawAgentId, workspacePath }, 'Starting agent provision job');

      const provisioned = await provisionOpenClawAgent({
        agentId: openClawAgentId,
        displayName,
        workspacePath,
        agentDirPath,
      });

      const processingTime = Date.now() - startTime;

      // Fetch current metadata to merge
      const { data: current } = await supabaseAdmin
        .from('agents')
        .select('metadata_json')
        .eq('id', agentId)
        .single();

      const nextMetadata = {
        ...((current?.metadata_json as Record<string, unknown>) || {}),
        openclaw: {
          ...(((current?.metadata_json as Record<string, unknown> | null)
            ?.openclaw) as Record<string, unknown> | undefined),
          provisionedAt: new Date().toISOString(),
          identityApplied: provisioned.identityApplied,
          identityWarning: provisioned.identityWarning || null,
        },
      };

      await supabaseAdmin
        .from('agents')
        .update({
          status: 'ready',
          metadata_json: nextMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId);

      // Bind agent to WhatsApp if account was provided at enqueue time
      if (job.data.whatsappAccount) {
        try {
          await bindAgentToChannel(openClawAgentId, 'whatsapp', job.data.whatsappAccount);
          logger.info({ agentId, openClawAgentId, account: job.data.whatsappAccount }, 'Agent bound to WhatsApp');
        } catch (bindError) {
          logger.warn(
            { agentId, openClawAgentId, error: bindError instanceof Error ? bindError.message : String(bindError) },
            'WhatsApp bind failed — agent is ready but not yet routed'
          );
        }
      }

      // Update job record
      await supabaseAdmin
        .from('jobs')
        .update({
          status: 'completed',
          result: { agentId, openClawAgentId, identityApplied: provisioned.identityApplied, provisionedAt: Date.now() },
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      recordJobMetricOpenTelemetry('agent_provision', 'success', processingTime, { agentId, openClawAgentId });

      await recordJobEvent(job.id!, JobEventType.COMPLETED, { agentId, openClawAgentId, identityApplied: provisioned.identityApplied }, job.data.correlationId || job.id!);

      logger.info({ agentId, openClawAgentId, processingTime }, 'Agent provision job completed');

      return {
        agentId,
        openClawAgentId,
        identityApplied: provisioned.identityApplied,
        provisionedAt: Date.now(),
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(
        { agentId, openClawAgentId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
        'Agent provision job failed'
      );

      recordJobMetricOpenTelemetry('agent_provision', 'failure', processingTime, { agentId, error: errorMessage });

      // Fetch current metadata to merge
      const { data: current } = await supabaseAdmin
        .from('agents')
        .select('metadata_json')
        .eq('id', agentId)
        .single();

      const nextMetadata = {
        ...((current?.metadata_json as Record<string, unknown>) || {}),
        openclaw: {
          ...(((current?.metadata_json as Record<string, unknown> | null)
            ?.openclaw) as Record<string, unknown> | undefined),
          lastError: errorMessage,
          failedAt: new Date().toISOString(),
        },
      };

      await supabaseAdmin
        .from('agents')
        .update({
          status: 'sync_failed',
          metadata_json: nextMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId);

      await supabaseAdmin
        .from('jobs')
        .update({
          status: job.attemptsMade + 1 >= (job.opts.attempts || 3) ? 'failed' : 'queued',
          error: { message: errorMessage, code: 'AGENT_PROVISION_FAILED', attemptNumber: job.attemptsMade + 1 },
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
