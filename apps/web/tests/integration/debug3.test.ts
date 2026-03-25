/**
 * Integration tests — mock verification: module mocks persist across tests
 * This verifies that vi.clearAllMocks() (not vi.restoreAllMocks()) is used in
 * setup.ts, preserving mockResolvedValue across tests within the same file.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/queue/producers', () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ id: 'job-verify-1', data: {} }),
  enqueueFileProcessing: vi.fn().mockResolvedValue({ id: 'job-verify-2', data: {} }),
  enqueueDataExport: vi.fn().mockResolvedValue({ id: 'job-verify-3', data: {} }),
  enqueueWebhook: vi.fn().mockResolvedValue({ id: 'job-verify-4', data: {} }),
}));
vi.mock('@/lib/queue/observability/correlation', () => ({
  generateCorrelationId: vi.fn().mockReturnValue('jq-verify'),
}));
vi.mock('@/lib/queue/observability/logger', () => {
  const noop = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis() };
  return { getLogger: vi.fn(() => noop), createContextLogger: vi.fn(() => noop) };
});

import { enqueueEmail } from '@/lib/queue/producers';
import { POST } from '@/app/api/jobs/enqueue/route';

describe('Mock persistence across tests', () => {
  it('first test — mock is active', async () => {
    const result = await enqueueEmail({ to: 'x@y.com', subject: 's', templateId: 't' } as any);
    expect(result.id).toBe('job-verify-1');
  });

  it('second test — mock still active after clearAllMocks', async () => {
    const req = new NextRequest('http://localhost/api/jobs/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobType: 'email', data: { to: 'test@example.com', subject: 'Hi', templateId: 'welcome' } }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.jobId).toBe('job-verify-1');
  });
});
