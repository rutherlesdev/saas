/**
 * POST /api/jobs/enqueue
 * 
 * Enqueue a job with type and data validation.
 * Provides single endpoint for all job types.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enqueueEmail,
  enqueueFileProcessing,
  enqueueDataExport,
  enqueueWebhook,
} from '@/lib/queue/producers';
import { generateCorrelationId } from '@/lib/queue/observability/correlation';
import { getLogger } from '@/lib/queue/observability/logger';

const logger = getLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobType, data, options } = body;

    if (!jobType || !data) {
      return NextResponse.json(
        { error: 'Missing jobType or data' },
        { status: 400 }
      );
    }

    const correlationId = options?.correlationId || generateCorrelationId();

    logger.info(
      { jobType, correlationId },
      'Enqueueing job via API'
    );

    let job;

    switch (jobType) {
      case 'email':
        job = await enqueueEmail(data, { ...options, correlationId });
        break;
      case 'file_processing':
        job = await enqueueFileProcessing(data, { ...options, correlationId });
        break;
      case 'data_export':
        job = await enqueueDataExport(data, { ...options, correlationId });
        break;
      case 'webhook':
        job = await enqueueWebhook(data, { ...options, correlationId });
        break;
      default:
        return NextResponse.json(
          { error: `Unknown job type: ${jobType}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      jobId: job.id,
      correlationId,
      status: 'queued',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Failed to enqueue job');

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
