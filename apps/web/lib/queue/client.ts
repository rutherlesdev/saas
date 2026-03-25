/**
 * Queue Client Factory
 * 
 * Provides singleton instances of Redis connections and Queue clients
 * with proper connection pooling and lifecycle management.
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CONFIG, QUEUE_NAMES, QUEUE_PREFIX } from './config';

type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Singleton instances
let redisConnection: Redis | null = null;
let redisSubscriber: Redis | null = null;
let queues: Map<QueueName, Queue> = new Map();
let queueEvents: Map<QueueName, QueueEvents> = new Map();

/**
 * Get or create Redis connection
 */
export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(REDIS_CONFIG);
    
    redisConnection.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
    
    redisConnection.on('ready', () => {
      console.log('Redis connection ready');
    });
  }
  
  return redisConnection;
}

/**
 * Get or create Redis subscriber connection (for PubSub)
 */
export function getRedisSubscriber(): Redis {
  if (!redisSubscriber) {
    redisSubscriber = new Redis(REDIS_CONFIG);
    
    redisSubscriber.on('error', (err) => {
      console.error('Redis subscriber connection error:', err);
    });
  }
  
  return redisSubscriber;
}

/**
 * Get or create a queue instance
 */
export function getQueue(queueName: QueueName): Queue {
  if (!queues.has(queueName)) {
    const queue = new Queue(queueName, {
      connection: getRedisConnection(),
      prefix: QUEUE_PREFIX,
      settings: {
        maxStalledCount: 2,
        lockDuration: 30000,
        lockRenewTime: 15000,
      },
    });
    
    queues.set(queueName, queue);
  }
  
  return queues.get(queueName)!;
}

/**
 * Get queue events listener
 */
export function getQueueEvents(queueName: QueueName): QueueEvents {
  if (!queueEvents.has(queueName)) {
    const events = new QueueEvents(queueName, {
      connection: getRedisSubscriber(),
      prefix: QUEUE_PREFIX,
    });
    
    queueEvents.set(queueName, events);
  }
  
  return queueEvents.get(queueName)!;
}

/**
 * Graceful shutdown of all connections
 */
export async function shutdownQueues(): Promise<void> {
  const shutdownPromises: Promise<void>[] = [];
  
  // Close all queues
  for (const queue of queues.values()) {
    shutdownPromises.push(queue.close());
  }
  
  // Close all queue events
  for (const events of queueEvents.values()) {
    shutdownPromises.push(events.close());
  }
  
  // Disconnect Redis
  if (redisConnection) {
    shutdownPromises.push(redisConnection.quit());
  }
  
  if (redisSubscriber) {
    shutdownPromises.push(redisSubscriber.quit());
  }
  
  await Promise.all(shutdownPromises);
  
  redisConnection = null;
  redisSubscriber = null;
  queues.clear();
  queueEvents.clear();
}

/**
 * Reset for testing purposes
 */
export async function resetQueues(): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    try {
      const redis = getRedisConnection();
      await redis.flushdb();
    } finally {
      await shutdownQueues();
    }

    return;
  }

  const queueInstances = Object.values(QUEUE_NAMES).map((queueName) =>
    getQueue(queueName)
  );

  await Promise.all(
    queueInstances.map(async (queue) => {
      try {
        await queue.pause();
        await queue.obliterate({ force: true });
      } catch (error) {
        console.warn(`Failed to obliterate queue ${queue.name}:`, error);
      }
    })
  );

  await shutdownQueues();
}
