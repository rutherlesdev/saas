/**
 * GET /api/metrics
 *
 * Lightweight JSON metrics endpoint for dashboards and alerting.
 * Aggregates queue depth and processing time statistics.
 */

import { NextResponse } from 'next/server';
import { getQueue } from '@/lib/queue/client';
import { QUEUE_NAMES } from '@/lib/queue/config';
import { getMetricsCollector } from '@/lib/queue/observability/metrics';

export async function GET() {
  try {
    let totalDepth = 0;
    let totalActive = 0;
    let totalDelayed = 0;
    let totalFailed = 0;

    const queueResults = await Promise.allSettled(
      Object.values(QUEUE_NAMES).map(async (name) => {
        const queue = getQueue(name);
        const [depth, active, delayed, failed] = await Promise.all([
          queue.count(),
          queue.getActiveCount(),
          queue.getDelayedCount(),
          queue.getFailedCount(),
        ]);
        return { name, depth, active, delayed, failed };
      })
    );

    const queues: Record<string, unknown> = {};
    for (const r of queueResults) {
      if (r.status === 'fulfilled') {
        const { name, depth, active, delayed, failed } = r.value;
        queues[name] = { depth, active, delayed, failed };
        totalDepth += depth;
        totalActive += active;
        totalDelayed += delayed;
        totalFailed += failed;
      }
    }

    const processingMetrics = getMetricsCollector().getMetrics();

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        jobsQueued: totalDepth,
        jobsRunning: totalActive,
        jobsDelayed: totalDelayed,
        jobsFailed: totalFailed,
      },
      processing: processingMetrics,
      queues,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to collect metrics' },
      { status: 500 }
    );
  }
}
