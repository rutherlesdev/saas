/**
 * Main Worker Process
 * 
 * Starts all queue workers with proper error handling, graceful shutdown,
 * and monitoring. Run this as a separate process from the Next.js app.
 * 
 * Usage: node --loader tsx ./lib/queue/worker.ts
 */

import { Worker } from 'bullmq';
import { getRedisConnection, getQueue, getQueueEvents, shutdownQueues } from './client';
import { QUEUE_NAMES, QUEUE_CONFIG, QUEUE_PREFIX } from './config';
import { validateRedisConnection } from './config';
import { processEmailJob } from './workers/email-worker';
import { processFileJob } from './workers/file-worker';
import { processWebhookJob } from './workers/webhook-worker';
import { getLogger, createContextLogger } from './observability/logger';
import { checkWorkerHealth } from './health';

let workers: Worker[] = [];
let isShuttingDown = false;

const logger = getLogger();

/**
 * Create worker for a queue
 */
function createWorker(
  queueName: typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES],
  processor: (job: any) => Promise<any>
) {
  const worker = new Worker(queueName, processor, {
    connection: getRedisConnection(),
    prefix: QUEUE_PREFIX,
    concurrency: QUEUE_CONFIG.concurrency,
    settings: {
      maxStalledCount: QUEUE_CONFIG.maxStalledCount,
      lockDuration: QUEUE_CONFIG.lockDuration,
      lockRenewTime: QUEUE_CONFIG.lockRenewTime,
    },
  });

  // Event listeners
  worker.on('completed', (job) => {
    logger.info(
      { jobId: job.id, queueName },
      'Job completed'
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, queueName, error: error.message },
      'Job failed'
    );
  });

  worker.on('error', (error) => {
    logger.error({ error: error.message, queueName }, 'Worker error');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId, queueName }, 'Job stalled');
  });

  return worker;
}

/**
 * Start all workers
 */
async function startWorkers() {
  try {
    // Validate Redis connection first
    logger.info('Validating Redis connection...');
    await validateRedisConnection();
    logger.info('Redis connection validated');

    logger.info('Starting workers...');

    // Create workers for each queue
    workers.push(createWorker(QUEUE_NAMES.EMAIL, processEmailJob));
    workers.push(createWorker(QUEUE_NAMES.FILE_PROCESSING, processFileJob));
    workers.push(createWorker(QUEUE_NAMES.WEBHOOK, processWebhookJob));

    // Simple cleanup worker
    workers.push(
      createWorker(QUEUE_NAMES.CLEANUP, async (job) => {
        logger.info({ jobId: job.id }, 'Running cleanup job');
        return { cleaned: true };
      })
    );

    logger.info({ workerCount: workers.length }, 'All workers started');

    // Setup graceful shutdown
    setupGracefulShutdown();

    // Log periodic health status
    logHealthStatus();
  } catch (error) {
    logger.error({ error }, 'Failed to start workers');
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown on signals
 */
function setupGracefulShutdown() {
  const signals = ['SIGTERM', 'SIGINT'];

  signals.forEach((signal) => {
    process.on(signal, async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info({ signal }, 'Received shutdown signal');

      try {
        // Close workers (stop accepting new jobs)
        logger.info('Closing workers...');
        await Promise.all(workers.map((w) => w.close()));

        // Shutdown queue connections
        logger.info('Shutting down queue connections...');
        await shutdownQueues();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    });
  });
}

/**
 * Log health status periodically
 */
function logHealthStatus() {
  setInterval(async () => {
    try {
      const health = await checkWorkerHealth();
      logger.info(
        { health },
        'Worker health check'
      );
    } catch (error) {
      logger.warn({ error }, 'Failed to check worker health');
    }
  }, 60000); // Every minute
}

/**
 * Entry point
 */
async function main() {
  logger.info(
    {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      redisHost: process.env.REDIS_HOST || 'localhost',
    },
    'Queue worker starting'
  );

  await startWorkers();

  logger.info('Worker ready to process jobs');
}

main().catch((error) => {
  logger.error({ error }, 'Unhandled error');
  process.exit(1);
});
