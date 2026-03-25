/**
 * GET /api/queue/metrics
 * 
 * Queue metrics and statistics for monitoring.
 */

import { NextResponse } from 'next/server';
import { getQueue } from '@/lib/queue/client';
import { QUEUE_NAMES } from '@/lib/queue/config';
import { getMetricsCollector } from '@/lib/queue/observability/metrics';

export async function GET() {
  try {
    const metrics: Record<string, any> = {};

    // Collect metrics for each queue
    for (const [key, queueName] of Object.entries(QUEUE_NAMES)) {
      const queue = getQueue(queueName);

      const [depth, active, delayed, failed, paused] = await Promise.all([
        queue.count(),
        queue.getActiveCount(),
        queue.getDelayedCount(),
        queue.getFailedCount(),
        queue.isPaused(),
      ]);

      metrics[queueName] = {
        depth,
        active,
        delayed,
        failed,
        paused,
      };
    }

    // Add processing metrics
    const processingMetrics = getMetricsCollector().getMetrics();

    return NextResponse.json({
      queues: metrics,
      processing: processingMetrics,
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get metrics' },
      { status: 500 }
    );
  }
}
