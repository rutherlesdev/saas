# Queue System Quick Start

Complete integration of a production-ready Redis-based job queue system into your Next.js + Supabase application.

## What's Included

✅ **Core Infrastructure**
- BullMQ queue system with Redis
- Type-safe job definitions with Zod
- Multiple queue support (email, files, webhooks, exports, cleanup)

✅ **Workers**
- Email worker with transactional email support
- File processing worker
- Webhook delivery worker with retries
- Cleanup job worker

✅ **API Routes**
- `POST /api/jobs/enqueue` - Enqueue jobs
- `GET /api/jobs/[id]/status` - Track job status
- `GET /api/health` - System health check
- `GET /api/queue/metrics` - Queue metrics

✅ **Observability**
- Structured logging with Pino
- Correlation ID tracking
- Metrics collection (processing time percentiles)
- Health checks for Redis and worker

✅ **Database**
- Supabase schema for job tracking
- Job events audit trail
- Processing results storage
- RLS policies for security

✅ **Testing**
- Producer tests with Zod validation
- Worker tests
- Integration tests
- Idempotency tests

✅ **Examples**
- React component for email submission
- Demo dashboard page
- useJobStatus hook for polling

---

## 5-Minute Setup

### 1. Install Dependencies (Already done!)

```bash
cd apps/web
npm install  # installs bullmq, ioredis, pino, zod, etc
```

### 2. Start Redis

```bash
# Using Docker (easiest)
docker run -d -p 6379:6379 --name redis redis:7-alpine

# Or using Homebrew (macOS)
brew install redis
redis-server
```

Verify: `redis-cli ping` → should print `PONG`

### 3. Setup Supabase Database Schema

1. Open Supabase Dashboard
2. Go to **SQL Editor** → **Create new query**
3. Copy the entire content of `QUEUE_SCHEMA.sql`
4. Paste and execute

This creates:
- `jobs` table
- `job_events` table
- `processing_results` table
- Indexes, RLS policies

### 4. Environment Variables

Add to `.env.local`:

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Supabase (copy from dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Queue
QUEUE_CONCURRENCY=10
LOG_LEVEL=debug
NODE_ENV=development
```

### 5. Start App & Worker

**Terminal 1 - App:**
```bash
npm run dev
# App runs on http://localhost:3000
```

**Terminal 2 - Worker:**
```bash
npm run dev:worker
# Worker processes jobs from Redis
```

---

## Test It Out

### Option A: Via API

```bash
# Enqueue email
curl -X POST http://localhost:3000/api/jobs/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "email",
    "data": {
      "to": "test@example.com",
      "subject": "Test",
      "templateId": "welcome"
    }
  }'

# Response: { "jobId": "email-xxx", "status": "queued" }
```

### Option B: Via Demo Page

Open: `http://localhost:3000/queue-demo`

- Enqueue samples
- Monitor in real-time
- Check health status

### Option C: From Code

```typescript
// In your Next.js route or server function
import { enqueueEmail } from '@/lib/queue/producers';

const job = await enqueueEmail({
  to: 'user@example.com',
  subject: 'Welcome',
  templateId: 'welcome',
  userId: 'user-123'
});

console.log('Job queued:', job.id);
```

---

## Key File Structure

```
lib/queue/
├── config.ts              # Redis & BullMQ settings
├── client.ts              # Queue client factory
├── jobs.ts                # Type definitions
├── health.ts              # Health checks
├── producers.ts           # Enqueue functions
├── worker.ts              # Worker startup
├── observability/
│   ├── logger.ts
│   ├── correlation.ts
│   └── metrics.ts
└── workers/
    ├── email-worker.ts
    ├── file-worker.ts
    └── webhook-worker.ts

app/api/
├── jobs/
│   ├── enqueue/route.ts
│   ├── [id]/status/route.ts
│   └── queue/metrics/route.ts
└── health/route.ts

hooks/
└── useJobStatus.ts        # React hook for job tracking
```

---

## Common Tasks

### Enqueue Different Job Types

```typescript
import {
  enqueueEmail,
  enqueueFileProcessing,
  enqueueWebhook,
  enqueueDataExport
} from '@/lib/queue/producers';

// Email
await enqueueEmail({
  to: 'user@example.com',
  subject: 'Subject',
  templateId: 'welcome'
});

// File processing
await enqueueFileProcessing({
  fileId: 'file-123',
  userId: 'user-123',
  bucket: 'uploads',
  path: 'file.pdf',
  mimeType: 'application/pdf',
  processType: 'extract'
});

// Webhook delivery
await enqueueWebhook({
  webhookId: 'webhook-123',
  url: 'https://api.example.com/webhook',
  event: 'user.created',
  payload: { userId: 'user-123' },
  userId: 'user-123'
});

// Data export
await enqueueDataExport({
  userId: 'user-123',
  exportType: 'csv',
  dataType: 'transactions'
});
```

### Handle Delayed Jobs

```typescript
// Enqueue email to send in 1 hour
await enqueueEmail(data, {
  delay: 3600000 // milliseconds
});
```

### Ensure Idempotency

```typescript
// Same key = same job (won't duplicate)
await enqueueEmail(data, {
  idempotencyKey: 'signup-email-user-123'
});
```

### Priority & Custom Options

```typescript
await enqueueEmail(data, {
  priority: 1,           // 1=highest, 10=lowest
  attempts: 5,           // custom retry attempts
  correlationId: 'corr-123'
});
```

### Track Job Status in React

```typescript
'use client';

import { useJobStatus } from '@/hooks/useJobStatus';

export function MyComponent() {
  const { status, loading, error } = useJobStatus(jobId);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <p>Status: {status?.job.status}</p>
      {status?.job.result && <pre>{JSON.stringify(status.job.result)}</pre>}
    </div>
  );
}
```

### Check System Health

```bash
curl http://localhost:3000/api/health
```

### View Queue Metrics

```bash
curl http://localhost:3000/api/queue/metrics
```

---

## Troubleshooting

### Redis not connecting?

```bash
# Check if running
redis-cli ping

# If not installed:
# macOS: brew install redis
# Linux: sudo apt-get install redis-server
# Docker: docker run -d -p 6379:6379 redis:7-alpine
```

### Jobs not being processed?

1. Check worker is running: `npm run dev:worker`
2. Check worker logs for errors
3. Verify Supabase credentials in `.env.local`
4. Check RLS policies allow service_role

### Database schema error?

Run `QUEUE_SCHEMA.sql` in Supabase SQL Editor:
- Open Supabase Dashboard
- SQL Editor → New Query
- Copy `QUEUE_SCHEMA.sql`
- Execute

### Jobs stuck in queue?

```bash
# Check Redis
redis-cli DBSIZE

# Check health endpoint
curl http://localhost:3000/api/health

# Monitor in real-time
watch -n 1 'curl -s http://localhost:3000/api/queue/metrics | jq'
```

---

## Running Tests

```bash
# Watch mode
npm run test

# Single run (CI)
npm run test:run

# With coverage
npm run test -- --coverage
```

---

## Next Steps

### Integrate Email Service

In `lib/queue/workers/email-worker.ts`, replace mock with real service:

```typescript
// Replace this:
return `msg-${Date.now()}-${Math.random()}`;

// With actual service (SendGrid, Mailgun, etc):
const response = await mailgunClient.messages.create({
  from: 'noreply@example.com',
  to: data.to,
  subject: data.subject,
  html: await renderTemplate(data.templateId, data.variables)
});
return response.id;
```

### Add Custom Job Types

1. Add schema to `lib/queue/jobs.ts`
2. Create producer function in `lib/queue/producers.ts`
3. Create worker in `lib/queue/workers/`
4. Add worker to `lib/queue/worker.ts`

Example:

```typescript
// jobs.ts
export const MyJobSchema = z.object({
  data: z.string()
});
export type MyJobData = z.infer<typeof MyJobSchema>;

// producers.ts
export async function enqueueMyJob(data: MyJobData) {
  const queue = getQueue('my-queue');
  return queue.add('process', data);
}

// my-worker.ts
export async function processMyJob(job: Job<MyJobData>) {
  // Process job
}
```

### Deploy to Production

See `QUEUE_SYSTEM.md` for:
- Docker Compose setup
- Kubernetes manifests
- Environment configuration
- Scaling considerations

---

## Architecture Diagram

```
User Browser
    ↓
Next.js App (Port 3000)
    ├─ API: POST /api/jobs/enqueue
    ├─ API: GET /api/jobs/[id]/status
    ├─ API: GET /api/health
    └─ API: GET /api/queue/metrics
    ↓
Redis Queue (Port 6379)
    ├─ email-queue
    ├─ file-processing-queue
    ├─ webhook-queue
    ├─ data-export-queue
    └─ cleanup-queue
    ↓
Worker Process (Node.js)
    ├─ EmailWorker
    ├─ FileWorker
    ├─ WebhookWorker
    └─ CleanupWorker
    ↓
Supabase Database
    ├─ jobs table
    ├─ job_events table
    └─ processing_results table
```

---

## Monitoring Checklist

- [ ] Redis health check passing
- [ ] Worker process is running
- [ ] `/api/health` returns "healthy"
- [ ] Jobs appear in Supabase `jobs` table
- [ ] Job events recorded in `job_events`
- [ ] Test email enqueue works
- [ ] Queue metrics endpoint accessible

---

## Support

- **Documentation:** See `QUEUE_SYSTEM.md` for complete guide
- **Examples:** Check `app/queue-demo/page.tsx`
- **Tests:** Run `npm run test` to see examples
- **Issues:** Check logs in worker terminal and app logs

---

**Happy queuing! 🚀**

Questions? Check the comprehensive `QUEUE_SYSTEM.md` guide.
