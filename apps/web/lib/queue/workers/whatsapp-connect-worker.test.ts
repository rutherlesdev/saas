/**
 * WhatsApp Connect Worker Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Job } from 'bullmq';
import { processWhatsAppConnectJob } from '@/lib/queue/workers/whatsapp-connect-worker';
import { WhatsAppConnectJobData } from '@/lib/queue/jobs';

vi.mock('@/lib/openclaw/agents', () => ({
  bindAgentToChannel: vi.fn().mockResolvedValue(undefined),
}));

function makeWaSupabaseChain(overrides: Record<string, unknown> = {}) {
  const chain: any = {
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    // terminal resolvers
    then: undefined as any,
    ...overrides,
  };
  // make eq() resolve when awaited (no further chaining)
  chain.eq = vi.fn(() => ({ ...chain, data: [], error: null, then: (r: any) => r({ data: [], error: null }) }));
  chain.select = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  });
  return chain;
}

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => makeWaSupabaseChain()),
  },
}));

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
}));

vi.mock('../observability/metrics', () => ({
  recordJobMetricOpenTelemetry: vi.fn(),
}));

vi.mock('@/lib/observability/tracing', () => ({
  withSpan: vi.fn((_name: string, fn: (span: any) => Promise<any>) =>
    fn({ setAttribute: vi.fn() })
  ),
}));

const mockJob = (data: Partial<WhatsAppConnectJobData> = {}): Job<WhatsAppConnectJobData> =>
  ({
    id: 'job-wa-123',
    queueName: 'whatsapp-connect-queue',
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: {
      userId: 'user-abc',
      accountName: 'default',
      event: 'connected',
      correlationId: 'corr-456',
      ...data,
    },
  } as any);

describe('WhatsApp Connect Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process connected event and return result', async () => {
    const { access } = await import('node:fs/promises');
    vi.mocked(access).mockResolvedValue(undefined);

    const result = await processWhatsAppConnectJob(mockJob({ event: 'connected' }));

    expect(result.event).toBe('connected');
    expect(result.accountName).toBe('default');
    expect(result.recordedAt).toBeTypeOf('number');
  });

  it('should process disconnected event and return result', async () => {
    const result = await processWhatsAppConnectJob(mockJob({ event: 'disconnected' }));

    expect(result.event).toBe('disconnected');
    expect(result.accountName).toBe('default');
  });

  it('should not throw if credentials file is missing on connect', async () => {
    const { access } = await import('node:fs/promises');
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'));

    await expect(
      processWhatsAppConnectJob(mockJob({ event: 'connected' }))
    ).resolves.toBeDefined();
  });

  it('should skip credentials check on disconnected event', async () => {
    const { access } = await import('node:fs/promises');

    await processWhatsAppConnectJob(mockJob({ event: 'disconnected' }));

    expect(access).not.toHaveBeenCalled();
  });

  it('should record OpenTelemetry metric on success', async () => {
    const { access } = await import('node:fs/promises');
    vi.mocked(access).mockResolvedValue(undefined);

    const { recordJobMetricOpenTelemetry } = await import('../observability/metrics');

    await processWhatsAppConnectJob(mockJob({ event: 'connected' }));

    expect(recordJobMetricOpenTelemetry).toHaveBeenCalledWith(
      'whatsapp_connect',
      'success',
      expect.any(Number),
      expect.objectContaining({ event: 'connected' })
    );
  });

  it('should record job event in audit trail', async () => {
    const { access } = await import('node:fs/promises');
    vi.mocked(access).mockResolvedValue(undefined);

    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeWaSupabaseChain({ insert: insertMock })
    );

    await processWhatsAppConnectJob(mockJob({ event: 'connected' }));

    expect(supabaseAdmin.from).toHaveBeenCalledWith('job_events');
  });
});
