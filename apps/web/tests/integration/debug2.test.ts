/**
 * Integration tests — /api/jobs/enqueue standalone (isolated mock scope)
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/queue/producers', () => ({
  enqueueEmail: vi.fn().mockResolvedValue({ id: 'job-email-iso', data: {} }),
  enqueueFileProcessing: vi.fn().mockResolvedValue({ id: 'job-file-iso', data: {} }),
  enqueueDataExport: vi.fn().mockResolvedValue({ id: 'job-export-iso', data: {} }),
  enqueueWebhook: vi.fn().mockResolvedValue({ id: 'job-webhook-iso', data: {} }),
}));
vi.mock('@/lib/queue/observability/correlation', () => ({
  generateCorrelationId: vi.fn().mockReturnValue('jq-isolated-corr-id'),
}));
vi.mock('@/lib/queue/observability/logger', () => ({
  getLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis() })),
  createContextLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
}));

import { POST } from '@/app/api/jobs/enqueue/route';

describe('POST /api/jobs/enqueue (isolated)', () => {
  it('enqueues a webhook job successfully', async () => {
    const req = new NextRequest('http://localhost/api/jobs/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobType: 'webhook', data: { url: 'https://example.com', method: 'POST', payload: {} } }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBeLessThan(300);
    expect(body.jobId).toBe('job-webhook-iso');
    expect(body.status).toBe('queued');
  });
});
