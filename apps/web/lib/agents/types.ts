export const AGENT_STATUSES = [
  "sync_pending",
  "provisioning",
  "ready",
  "sync_failed",
] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];

export type AgentMetadata = Record<string, unknown> | null;

export interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  status: AgentStatus;
  workspace_path: string;
  openclaw_agent_id: string | null;
  binding_key: string | null;
  metadata_json: AgentMetadata;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentInput {
  name: string;
  bindingKey?: string | null;
  accountId?: string | null;
  metadataJson?: Record<string, unknown> | null;
}

export type OpenClawSyncMode = "immediate" | "deferred";

export interface CreateAgentResult {
  agent: AgentRecord;
  sync: {
    mode: OpenClawSyncMode;
    state: "ready" | "pending" | "failed";
    error?: string | null;
    jobId?: string;
  };
}
