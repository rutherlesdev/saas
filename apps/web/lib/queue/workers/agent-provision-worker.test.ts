/**
 * Agent Provision Worker Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Job } from 'bullmq';
import { processAgentProvisionJob } from '@/lib/queue/workers/agent-provision-worker';
import { AgentProvisionJobData } from '@/lib/queue/jobs';

function makeSupabaseChain(overrides: Record<string, unknown> = {}) {
  const chain: any = {
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { metadata_json: {} }, error: null }),
    ...overrides,
  };
  return chain;
}

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => makeSupabaseChain()),
  },
}));

vi.mock('@/lib/openclaw/agents', () => ({
  provisionOpenClawAgent: vi.fn(),
}));

vi.mock('../observability/metrics', () => ({
  recordJobMetricOpenTelemetry: vi.fn(),
}));

vi.mock('@/lib/observability/tracing', () => ({
  withSpan: vi.fn((_name: string, fn: (span: any) => Promise<any>) =>
    fn({ setAttribute: vi.fn() })
  ),
}));

const mockJob = (data: Partial<AgentProvisionJobData> = {}): Job<AgentProvisionJobData> =>
  ({
    id: 'job-agent-123',
    queueName: 'agent-provision-queue',
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: {
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-abc',
      openClawAgentId: 'oc-agent-xyz',
      displayName: 'Test Agent',
      workspacePath: '/workspaces/user-abc/test-agent',
      agentDirPath: '/agents/user-abc/test-agent',
      correlationId: 'corr-123',
      ...data,
    },
  } as any);

describe('Agent Provision Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provision agent successfully and return result', async () => {
    const { provisionOpenClawAgent } = await import('@/lib/openclaw/agents');
    vi.mocked(provisionOpenClawAgent).mockResolvedValue({
      agentId: 'oc-agent-xyz',
      workspace: '/workspaces/user-abc/test-agent',
      agentDir: '/agents/user-abc/test-agent',
      identityApplied: true,
    });

    const result = await processAgentProvisionJob(mockJob());

    expect(result.agentId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.openClawAgentId).toBe('oc-agent-xyz');
    expect(result.identityApplied).toBe(true);
    expect(result.provisionedAt).toBeTypeOf('number');
  });

  it('should update agent status to ready on success', async () => {
    const { provisionOpenClawAgent } = await import('@/lib/openclaw/agents');
    vi.mocked(provisionOpenClawAgent).mockResolvedValue({
      agentId: 'oc-agent-xyz',
      workspace: '/workspaces/user-abc/test-agent',
      agentDir: '/agents/user-abc/test-agent',
      identityApplied: true,
    });

    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const updateMock = vi.fn().mockReturnThis();
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSupabaseChain({ update: updateMock })
    );

    await processAgentProvisionJob(mockJob());

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready' })
    );
  });

  it('should update agent status to sync_failed and rethrow on error', async () => {
    const { provisionOpenClawAgent } = await import('@/lib/openclaw/agents');
    vi.mocked(provisionOpenClawAgent).mockRejectedValue(new Error('OpenClaw CLI failed'));

    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const updateMock = vi.fn().mockReturnThis();
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSupabaseChain({ update: updateMock })
    );

    await expect(processAgentProvisionJob(mockJob())).rejects.toThrow('OpenClaw CLI failed');

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sync_failed' })
    );
  });

  it('should record OpenTelemetry metric on success', async () => {
    const { provisionOpenClawAgent } = await import('@/lib/openclaw/agents');
    vi.mocked(provisionOpenClawAgent).mockResolvedValue({
      agentId: 'oc-agent-xyz',
      workspace: '/workspaces/user-abc/test-agent',
      agentDir: '/agents/user-abc/test-agent',
      identityApplied: false,
    });

    const { recordJobMetricOpenTelemetry } = await import('../observability/metrics');

    await processAgentProvisionJob(mockJob());

    expect(recordJobMetricOpenTelemetry).toHaveBeenCalledWith(
      'agent_provision',
      'success',
      expect.any(Number),
      expect.objectContaining({ agentId: '550e8400-e29b-41d4-a716-446655440000' })
    );
  });

  it('should record failure metric on error', async () => {
    const { provisionOpenClawAgent } = await import('@/lib/openclaw/agents');
    vi.mocked(provisionOpenClawAgent).mockRejectedValue(new Error('timeout'));

    const { recordJobMetricOpenTelemetry } = await import('../observability/metrics');

    await expect(processAgentProvisionJob(mockJob())).rejects.toThrow();

    expect(recordJobMetricOpenTelemetry).toHaveBeenCalledWith(
      'agent_provision',
      'failure',
      expect.any(Number),
      expect.objectContaining({ error: 'timeout' })
    );
  });
});
