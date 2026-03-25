/**
 * Health Checks
 * 
 * Monitors Redis and worker health, queue depth, and system status.
 * Provides endpoints for load balancers and monitoring systems.
 */

import { getRedisConnection, getQueue } from './client';
import { QUEUE_NAMES } from './config';
import { getLogger } from './observability/logger';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  redis: {
    status: 'connected' | 'disconnected';
    latency?: number;
    error?: string;
  };
  queues: Record<
    string,
    {
      depth: number;
      active: number;
      delayed: number;
      failed: number;
      paused: boolean;
    }
  >;
  timestamp: number;
}

/**
 * Check Redis connectivity and latency
 */
export async function checkRedisHealth(): Promise<{
  status: 'connected' | 'disconnected';
  latency?: number;
  error?: string;
}> {
  try {
    const redis = getRedisConnection();
    const start = Date.now();
    const result = await redis.ping();
    const latency = Date.now() - start;

    if (result !== 'PONG') {
      return {
        status: 'disconnected',
        error: 'Redis PING failed',
      };
    }

    return {
      status: 'connected',
      latency,
    };
  } catch (error) {
    return {
      status: 'disconnected',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get queue metrics
 */
export async function getQueueHealth(queueName: string) {
  try {
    const queue = getQueue(queueName as any);

    const [waitCount, activeCount, delayedCount, failedCount, pausedStatus] =
      await Promise.all([
        queue.count(),
        queue.getActiveCount(),
        queue.getDelayedCount(),
        queue.getFailedCount(),
        queue.isPaused(),
      ]);

    return {
      depth: waitCount,
      active: activeCount,
      delayed: delayedCount,
      failed: failedCount,
      paused: pausedStatus,
    };
  } catch (error) {
    getLogger().error(
      { queueName, error },
      'Failed to get queue health'
    );
    return {
      depth: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      paused: false,
    };
  }
}

/**
 * Comprehensive health check
 */
export async function getSystemHealth(): Promise<HealthStatus> {
  const redisHealth = await checkRedisHealth();
  const queues: Record<string, any> = {};

  for (const queueName of Object.values(QUEUE_NAMES)) {
    queues[queueName] = await getQueueHealth(queueName);
  }

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (redisHealth.status === 'disconnected') {
    overallStatus = 'unhealthy';
  } else if (redisHealth.latency && redisHealth.latency > 500) {
    overallStatus = 'degraded';
  }

  // Check for queue issues
  for (const queue of Object.values(queues)) {
    if (queue.failed > 100) {
      overallStatus = 'degraded';
    }
    if (queue.active === 0 && queue.depth > 1000) {
      overallStatus = 'degraded';
    }
  }

  return {
    status: overallStatus,
    redis: redisHealth,
    queues,
    timestamp: Date.now(),
  };
}

/**
 * Worker health - checks if worker is processing jobs
 */
export async function checkWorkerHealth(): Promise<{
  status: 'active' | 'idle' | 'unhealthy';
  lastHeartbeat?: number;
  processingJobs: number;
}> {
  try {
    let processingJobs = 0;

    for (const queueName of Object.values(QUEUE_NAMES)) {
      const queue = getQueue(queueName as any);
      processingJobs += await queue.getActiveCount();
    }

    // If there are jobs being processed or queued, worker is active
    const totalQueued = (
      await Promise.all(
        Object.values(QUEUE_NAMES).map((name) =>
          getQueue(name as any).count()
        )
      )
    ).reduce((a, b) => a + b, 0);

    const status = processingJobs > 0 || totalQueued > 0 ? 'active' : 'idle';

    return {
      status,
      lastHeartbeat: Date.now(),
      processingJobs,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      processingJobs: 0,
    };
  }
}
