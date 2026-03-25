/**
 * File Processing Worker
 * 
 * Processes file uploads: extract metadata, convert formats,
 * validate content, or analyze files.
 */

import { Job } from 'bullmq';
import { FileProcessingJobData, JobEventType } from '../jobs';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createContextLogger } from '../observability/logger';
import { recordJobMetricOpenTelemetry } from '../observability/metrics';

export async function processFileJob(job: Job<FileProcessingJobData>) {
  const logger = createContextLogger({
    correlationId: job.data.correlationId || job.id!,
    jobId: job.id!,
    queueName: job.queueName,
  });

  const startTime = Date.now();

  try {
    logger.info(
      { fileId: job.data.fileId, processType: job.data.processType },
      'Starting file processing job'
    );

    const result = await processFile(job.data);
    const processingTime = Date.now() - startTime;

    // Update Supabase
    await supabaseAdmin.from('jobs').update({
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);

    recordJobMetricOpenTelemetry('file_processing', 'success', processingTime, {
      fileId: job.data.fileId,
      processType: job.data.processType,
    });

    logger.info({ fileId: job.data.fileId, processingTime }, 'File processing completed');
    return result;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error({ error: errorMessage }, 'File processing failed');

    recordJobMetricOpenTelemetry('file_processing', 'failure', processingTime, {
      fileId: job.data.fileId,
      error: errorMessage,
    });

    await supabaseAdmin.from('jobs').update({
      status: job.attemptsMade + 1 >= (job.opts.attempts || 3) ? 'failed' : 'queued',
      error: { message: errorMessage, code: 'PROCESSING_FAILED' },
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);

    throw error;
  }
}

async function processFile(data: FileProcessingJobData) {
  // Simulate file processing
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    fileId: data.fileId,
    processedPath: `processed/${data.fileId}`,
    metadata: {
      processType: data.processType,
      processedAt: new Date().toISOString(),
      size: Math.random() * 1000000,
    },
    processedAt: Date.now(),
  };
}
