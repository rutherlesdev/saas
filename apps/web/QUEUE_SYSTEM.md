# Redis-Based Queue System

Complete production-ready async processing system using BullMQ + Redis integrated into your Next.js/Supabase stack.

## Architecture Overview

```
┌─────── Next.js App (Port 3000) ─────────────┐
│  API Routes:                                 │
│  - POST /api/jobs/enqueue ────┐             │
│  - GET /api/jobs/[id]/status  │             │
│  - GET /api/health            │             │
│  - GET /api/queue/metrics     │             │
│                                │             │
│  Producers:                    │             │
│  - enqueueEmail()              │             │
│  - enqueueFileProcessing()     │             │
│  - enqueueDataExport()         │             │
│  - enqueueWebhook()            │             │
└────────────────────────────────┼─────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │   Redis Instance         │
                    │  (Port 6379)             │
                    │                          │
                    │  Queues:                 │
                    │  - email-queue           │
                    │  - file-processing-queue│
                    │  - webhook-queue        │
                    │  - data-export-queue    │
                    │  - cleanup-queue        │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │  Worker Process          │
                    │  (Separate Node.js)      │
                    │                          │
                    │  Workers:                │
                    │  - EmailWorker           │
                    │  - FileWorker            │
                    │  - WebhookWorker         │
                    │  - CleanupWorker         │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼──────────────┐
                    │  Supabase               │
                    │  - jobs (tracking)      │
                    │  - job_events (audit)   │
                    │  - processing_results   │
                    └─────────────────────────┘
```

## Key Features

- **Type-Safe Job Definitions** - Zod schemas for all job types
- **Exponential Backoff Retries** - Configurable retry strategy
- **Idempotency Keys** - Prevent duplicate processing
- **Correlation IDs** - Track requests through the system
- **Structured Logging** - Pino-based logging with context
- **Metrics Collection** - Processing time percentiles, success rates
- **Health Checks** - Redis and worker health monitoring
- **Graceful Shutdown** - Proper cleanup on SIGTERM
- **Supabase Integration** - Persistent job metadata and audit trails
- **Flexible Job Types** - Email, file processing, webhooks, exports, cleanup

## File Structure

```
lib/queue/
├── config.ts                          # Redis & BullMQ configuration
├── client.ts                          # Queue client factory
├── jobs.ts                            # Job type definitions with Zod
├── health.ts                          # Health checks
├── producers.ts                       # Enqueue job functions
├── observability/
│   ├── logger.ts                      # Structured logging
│   ├── correlation.ts                 # Correlation ID tracking
│   └── metrics.ts                     # Metrics collection
└── workers/
    ├── worker.ts                      # Main worker startup
    ├── email-worker.ts                # Email job processor
    ├── file-worker.ts                 # File processing processor
    └── webhook-worker.ts              # Webhook delivery processor
app/api/
├── jobs/
│   ├── enqueue/route.ts               # POST endpoint to enqueue jobs
│   ├── [id]/
│   │   └── status/route.ts            # GET job status
│   └── queue/
│       └── metrics/route.ts           # Queue metrics
└── health/route.ts                    # System health check
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd apps/web
npm install
```

All required packages are already in package.json:
- `bullmq` - Job queue
- `ioredis` - Redis client
- `pino` - Structured logging
- `zod` - Schema validation
- `nanoid` - ID generation
- `tsx` - TypeScript runner for worker

### 2. Setup Redis Locally (Development)

#### Using Docker:

```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

#### Or install Redis directly:

**macOS:**
```bash
brew install redis
redis-server
```

**Linux (Ubuntu):**
```bash
sudo apt-get install redis-server
redis-server
```

**Windows:**
Download from https://github.com/microsoftarchive/redis/releases

### 3. Setup Supabase Database Schema

Run the SQL in `QUEUE_SCHEMA.sql`:

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Create new query
4. Copy and paste contents of `QUEUE_SCHEMA.sql`
5. Run query

This creates:
- `jobs` table - Core job tracking
- `job_events` table - Audit trail
- `processing_results` table - Results storage
- Indexes and RLS policies

### 4. Configure Environment Variables

Copy to `.env.local`:

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Supabase (get from dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Queue
QUEUE_CONCURRENCY=10
LOG_LEVEL=debug
```

## Running

### Terminal 1: Start Next.js App

```bash
npm run dev
```

App runs on `http://localhost:3000`

### Terminal 2: Start Worker Process

```bash
npm run dev:worker
```

Worker connects to Redis and processes jobs from all queues.

## Usage Examples

### Enqueue Email Job via API

```bash
curl -X POST http://localhost:3000/api/jobs/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "email",
    "data": {
      "to": "user@example.com",
      "subject": "Welcome!",
      "templateId": "welcome",
      "variables": { "name": "John" },
      "userId": "user-123"
    }
  }'
```

Response:
```json
{
  "jobId": "email-job-123",
  "correlationId": "jq-abc123...",
  "status": "queued"
}
```

### Check Job Status

```bash
curl http://localhost:3000/api/jobs/email-job-123/status
```

Response:
```json
{
  "job": {
    "id": "email-job-123",
    "status": "completed",
    "result": {
      "messageId": "msg-...",
      "sentAt": 1234567890
    },
    ...
  },
  "events": [
    { "eventType": "job.queued", "timestamp": ... },
    { "eventType": "job.started", "timestamp": ... },
    { "eventType": "job.completed", "timestamp": ... }
  ]
}
```

### Enqueue from Code

```typescript
import { enqueueEmail, enqueueFileProcessing } from '@/lib/queue/producers';

// Email job
const emailJob = await enqueueEmail({
  to: 'user@example.com',
  subject: 'Reset Password',
  templateId: 'password-reset',
  variables: { link: '...' },
  userId: 'user-123'
});

// File processing job
const fileJob = await enqueueFileProcessing({
  fileId: 'file-123',
  userId: 'user-123',
  bucket: 'uploads',
  path: 'file.pdf',
  mimeType: 'application/pdf',
  processType: 'extract'
});

// Webhook delivery
const webhookJob = await enqueueWebhook({
  webhookId: 'webhook-123',
  url: 'https://api.example.com/webhook',
  event: 'user.created',
  payload: { userId: 'user-123' },
  userId: 'user-123'
});
```

### Idempotency Example

```typescript
// Same idempotency key = same job (won't be re-enqueued)
const job1 = await enqueueEmail(data, {
  idempotencyKey: 'signup-email-user-123'
});

const job2 = await enqueueEmail(data, {
  idempotencyKey: 'signup-email-user-123'
});

// job1.id === job2.id
```

## System Health & Monitoring

### Check System Health

```bash
curl http://localhost:3000/api/health
```

Response when healthy:
```json
{
  "status": "healthy",
  "redis": {
    "status": "connected",
    "latency": 2
  },
  "queues": {
    "email-queue": {
      "depth": 5,
      "active": 2,
      "delayed": 0,
      "failed": 0,
      "paused": false
    },
    ...
  },
  "timestamp": 1234567890
}
```

### Queue Metrics

```bash
curl http://localhost:3000/api/queue/metrics
```

Response:
```json
{
  "queues": {
    "email-queue": {
      "depth": 10,
      "active": 3,
      "delayed": 2,
      "failed": 1,
      "paused": false
    },
    ...
  },
  "processing": {
    "totalRecords": 1000,
    "averageTime": 245,
    "p50": 200,
    "p95": 800,
    "p99": 1200
  },
  "timestamp": 1234567890
}
```

## Job Types

### Email Queue

```typescript
{
  to: string;           // email@example.com
  subject: string;      // Email subject
  templateId: string;   // Template ID from email service
  variables?: object;   // Template variables
  userId?: string;      // User ID for tracking
  priority?: 'high' | 'normal' | 'low';
}
```

### File Processing Queue

```typescript
{
  fileId: string;           // Unique file ID
  userId: string;           // User who uploaded
  bucket: string;           // Supabase storage bucket
  path: string;             // File path in bucket
  mimeType: string;         // MIME type
  processType: 'extract' | 'convert' | 'validate' | 'analyze';
  options?: object;         // Processing options
}
```

### Webhook Queue

```typescript
{
  webhookId: string;    // Webhook ID from DB
  url: string;          // Delivery URL
  event: string;        // Event type ('user.created', etc)
  payload: object;      // Event payload
  userId: string;       // Associated user
  timeout?: number;     // Request timeout (default: 30s)
}
```

### Data Export Queue

```typescript
{
  userId: string;           // User requesting export
  exportType: 'csv' | 'pdf' | 'json';
  dataType: string;         // Type of data to export
  filter?: object;          // Filter criteria
  batchSize?: number;       // Batch size (default: 1000)
}
```

### Cleanup Queue

```typescript
{
  cleanupType: 'expired_sessions' | 'old_logs' | 'temp_files';
  retentionDays?: number;   // Days to keep (default: 30)
  dryRun?: boolean;         // Test run without deleting
}
```

## Testing

### Run Tests

```bash
npm run test
```

### Run Tests Once (CI mode)

```bash
npm run test:run
```

Tests are in:
- `lib/queue/producers.test.ts` - Producer tests
- `lib/queue/workers/email-worker.test.ts` - Worker tests

Test coverage includes:
- Valid job enqueueing
- Invalid data rejection
- Idempotency handling
- Job processing success/failure
- Retry logic
- Status tracking

## Production Deployment

### Docker Compose Example

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      REDIS_HOST: redis
      REDIS_DB: 0
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
    depends_on:
      redis:
        condition: service_healthy

  worker:
    build: .
    command: npm run start:worker
    environment:
      REDIS_HOST: redis
      REDIS_DB: 0
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      NODE_ENV: production
    depends_on:
      redis:
        condition: service_healthy

volumes:
  redis-data:
```

### Production Considerations

1. **Redis Persistence**
   - Enable RDB snapshots: `save 900 1`
   - or AOF: `appendonly yes`
   - Use Redis cluster for HA

2. **Worker Scaling**
   - Run multiple worker instances
   - Use environment-specific concurrency
   - Monitor queue depth for scaling signals

3. **Database Backups**
   - Backup Supabase regularly
   - Archive old job records periodically
   - Use provided `archive_old_jobs()` function

4. **Monitoring**
   - Use health checks for load balancers
   - Monitor queue depth and processing time
   - Set up alerts on failure rates
   - Log all job events to Supabase

5. **Rate Limiting**
   - Use `priority` field to prioritize critical jobs
   - Implement rate limiting per user
   - Use `delay` for scheduled jobs

## Configuration Tuning

### For High Throughput

```typescript
// config.ts
QUEUE_CONFIG = {
  concurrency: 50,              // Increase workers
  maxAttempts: 2,               // Fewer retries
  initialDelay: 500,            // Faster retry
  removeOnComplete: { age: 600 } // Shorter history
}
```

### For Reliability (Email, Webhooks)

```typescript
QUEUE_CONFIG = {
  concurrency: 5,               // Slower, careful processing
  maxAttempts: 5,               // More retries
  initialDelay: 2000,           // Longer backoff
  removeOnComplete: { age: 86400 } // Keep history 24h
}
```

### For Development

```typescript
QUEUE_CONFIG = {
  concurrency: 1,               // Sequential processing
  maxAttempts: 1,               // No retries (debug faster)
  removeOnComplete: false,      // Keep everything
  removeOnFail: false
}
```

## Troubleshooting

### "Redis connection failed"

**Solution:**
```bash
# Check Redis is running
redis-cli ping
# Should print: PONG

# Check connection details
REDIS_HOST=localhost REDIS_PORT=6379 redis-cli ping
```

### Jobs not processing

**Check:**
1. Worker process running: `npm run dev:worker`
2. Redis has jobs: `http://localhost:3000/api/queue/metrics`
3. Worker logs for errors
4. Check RLS policies in Supabase allow service_role

### Jobs stuck in "processing"

**Solution:**
```bash
# Check stalled jobs
redis-cli KEYS "bullmq:*:active"

# Get number of active jobs
redis-cli ZCARD "bullmq:email-queue:active"

# Clear stalled jobs (last resort)
redis-cli FLUSHDB # Careful! Only in development
```

### High failure rate

**Check:**
1. Job data validation - run `npm run test`
2. External service availability (email service, file storage)
3. Worker concurrency - reduce in config
4. Database RLS policies are correct

## API Reference

### POST /api/jobs/enqueue

Enqueue a job.

**Request:**
```json
{
  "jobType": "email|file_processing|data_export|webhook|cleanup",
  "data": { ... },
  "options": {
    "correlationId": "string",    // optional
    "idempotencyKey": "string",   // optional
    "delay": 5000,                // optional, milliseconds
    "priority": 1,                // optional, higher = more important
    "attempts": 3                 // optional
  }
}
```

**Response (200):**
```json
{
  "jobId": "string",
  "correlationId": "string",
  "status": "queued"
}
```

### GET /api/jobs/[id]/status

Get job status and events.

**Response (200):**
```json
{
  "job": { ... },
  "events": [ ... ]
}
```

### GET /api/health

System health check.

**Response (200 if healthy, 503 if degraded, 500 if unhealthy):**
```json
{
  "status": "healthy|degraded|unhealthy",
  "redis": { ... },
  "queues": { ... },
  "timestamp": number
}
```

### GET /api/queue/metrics

Queue metrics.

**Response (200):**
```json
{
  "queues": { ... },
  "processing": { ... },
  "timestamp": number
}
```

## Future Improvements

1. **OpenTelemetry Integration**
   - Replace metric collection with OTEL
   - Integrate with Datadog, New Relic, etc.

2. **Dead Letter Queue**
   - Automatic DLQ for permanently failed jobs
   - Manual retry endpoint

3. **Scheduled Jobs UI**
   - Dashboard for viewing queue status
   - Manual job triggering

4. **Rate Limiting**
   - Per-user job enqueue limits
   - Global queue rate limiting

5. **Job Timeouts**
   - Automatic timeout after X seconds
   - Configurable per queue

6. **Custom Processors**
   - Plugin architecture for custom job types
   - Loader system for dynamic workers

7. **Batch Processing**
   - Process multiple jobs together
   - Bulk operation optimization

8. **Webhook Signing**
   - HMAC signing for webhook authenticity
   - Webhook secret management

## Support & Issues

- Check logs: `tail -f .next/stderr.log`
- Inspect Redis: `redis-cli`
- Query Supabase: Supabase Dashboard > SQL Editor
- Review tests for examples: `lib/queue/*.test.ts`
