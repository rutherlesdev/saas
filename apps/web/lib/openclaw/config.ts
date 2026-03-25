import type { OpenClawSyncMode } from "@/lib/agents/types";

export interface OpenClawConfig {
  bin: string;
  profile?: string;
  model?: string;
  syncMode: OpenClawSyncMode;
  workspacesRoot: string;
  agentStateRoot: string;
  timeoutMs: number;
}

export function getOpenClawConfig(): OpenClawConfig {
  const syncMode =
    process.env.OPENCLAW_SYNC_MODE === "deferred" ? "deferred" : "immediate";

  return {
    bin: process.env.OPENCLAW_BIN || "openclaw",
    profile: process.env.OPENCLAW_PROFILE?.trim() || undefined,
    model: process.env.OPENCLAW_MODEL?.trim() || undefined,
    syncMode,
    workspacesRoot:
      process.env.OPENCLAW_WORKSPACES_ROOT ||
      `${process.env.HOME || "/home/openclaw"}/.openclaw/workspaces`,
    agentStateRoot:
      process.env.OPENCLAW_AGENT_STATE_ROOT ||
      `${process.env.HOME || "/home/openclaw"}/.openclaw/agents`,
    timeoutMs: Number(process.env.OPENCLAW_TIMEOUT_MS || 30_000),
  };
}

export function getOpenClawGlobalArgs(config: OpenClawConfig) {
  if (!config.profile) {
    return [];
  }

  return ["--profile", config.profile];
}
