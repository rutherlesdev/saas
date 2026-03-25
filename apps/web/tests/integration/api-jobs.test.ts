/**
 * Integration tests — /api/jobs/enqueue route
 * Tests request validation, job routing, and response shape.
 */

import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock all producers — no real Redis/Supabase in integration tests
vi.mock('@/lib/queue/producers', () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ id: 'job-email-1', data: {} }),
  enqueueFileProcessing: vi.fn().mockResolvedValue({ id: 'job-file-1', data: {} }),
  enqueueDataExport: vi.fn().mockResolvedValue({ id: 'job-export-1', data: {} }),
  enqueueWebhook: vi.fn().mockResolvedValue({ id: 'job-webhook-1', data: {} }),
}));

vi.mock('@/lib/queue/observability/correlation', () => ({
  generateCorrelationId: vi.fn().mockReturnValue('jq-test-corr-id'),
  extractCorrelationId: vi.fn().mockReturnValue('jq-test-corr-id'),
}));

// The route calls getLogger() at module level — return a no-op logger
vi.mock('@/lib/queue/observability/logger', () => {
  const noopLog = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
  return { getLogger: vi.fn(() => noopLog), createContextLogger: vi.fn(() => noopLog) };
});

import { POST } from '@/app/api/jobs/enqueue/route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/jobs/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/jobs/enqueue', () => {
  it('returns 400 when jobType is missing', async () => {
    const req = makeRequest({ data: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when data is missing', async () => {
    const req = makeRequest({ jobType: 'email' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('enqueues an email job successfully', async () => {
    const req = makeRequest({
      jobType: 'email',
      data: { to: 'test@example.com', subject: 'Hi', templateId: 'welcome' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBeLessThan(300);
    expect(body.jobId).toBeDefined();
    expect(body.correlationId).toBeDefined();
  });

  it('returns 400 for unknown job type', async () => {
    const req = makeRequest({ jobType: 'unknown-type', data: {} });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unknown/i);
  });
});
