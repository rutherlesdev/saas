/**
 * BullMQ & Redis Configuration
 * 
 * This module centralizes Redis and queue configuration with
 * sensible production defaults and environment overrides.
 */

export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
  lazyConnect: false,
  connectTimeout: 10000,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
} as const;

export const QUEUE_PREFIX =
  process.env.QUEUE_PREFIX ||
  (process.env.NODE_ENV === 'test' && process.env.VITEST_WORKER_ID
    ? `saas-test-${process.env.VITEST_WORKER_ID}`
    : 'bull');

export const QUEUE_CONFIG = {
  // Worker configuration
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10', 10),
  maxStalledCount: 2,
  lockDuration: 30000, // 30 seconds
  lockRenewTime: 15000, // 15 seconds

  // Retry configuration
  defaultRetryBackoff: 'exponential',
  maxAttempts: 3,
  backoffMultiplier: 2,
  initialDelay: 1000,

  // Job removal policy
  removeOnComplete: {
    age: 3600, // Keep logs for 1 hour
  },
  removeOnFail: {
    age: 86400, // Keep failed job logs 24 hours for debugging
  },

  // Keep track of rate limit
  rateLimit: {
    max: 100,
    duration: 60000, // per minute
  },
} as const;

export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  FILE_PROCESSING: 'file-processing-queue',
  DATA_EXPORT: 'data-export-queue',
  WEBHOOK: 'webhook-queue',
  CLEANUP: 'cleanup-queue',
} as const;

/**
 * Validate Redis connection can be established
 */
export async function validateRedisConnection(): Promise<void> {
  try {
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(REDIS_CONFIG);
    
    try {
      const ping = await redis.ping();
      if (ping !== 'PONG') {
        throw new Error('Redis PING check failed');
      }
    } finally {
      await redis.quit();
    }
  } catch (error) {
    throw new Error(
      `Redis connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
