/**
 * GET /api/health/queue
 *
 * Dedicated queue + Redis health check endpoint.
 * Lighter than the full /api/health — use this for queue-specific liveness probes.
 */

import { NextResponse } from 'next/server';
import { checkRedisHealth, getQueueHealth } from '@/lib/queue/health';
import { QUEUE_NAMES } from '@/lib/queue/config';

export async function GET() {
  try {
    const redis = await checkRedisHealth();

    // Collect per-queue depth/active counts
    const queueResults = await Promise.allSettled(
      Object.values(QUEUE_NAMES).map(async (name) => ({
        name,
        health: await getQueueHealth(name),
      }))
    );

    const queues: Record<string, unknown> = {};
    for (const r of queueResults) {
      if (r.status === 'fulfilled') {
        queues[r.value.name] = r.value.health;
      }
    }

    const ok = redis.status === 'connected';

    return NextResponse.json(
      {
        status: ok ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        redis,
        queues,
      },
      { status: ok ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
