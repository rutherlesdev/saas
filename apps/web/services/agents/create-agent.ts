import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AgentMetadata,
  AgentRecord,
  CreateAgentInput,
  CreateAgentResult,
} from "@/lib/agents/types";
import {
  buildAgentWorkspacePath,
  buildOpenClawAgentDirPath,
  buildOpenClawAgentId,
  buildUniqueSlug,
  createAgentSlug,
} from "@/lib/agents/utils";
import { withSpan } from "@/lib/observability/tracing";
import { getLogger } from "@/lib/queue/observability/logger";
import { generateCorrelationId } from "@/lib/queue/observability/correlation";
import { getOpenClawConfig } from "@/lib/openclaw/config";
import { getWhatsAppStatus } from "@/lib/openclaw/channels";
import { enqueueAgentProvision } from "@/lib/queue/producers";

const logger = getLogger();

async function getExistingSlugs(
  supabase: SupabaseClient,
  userId: string,
  baseSlug: string
) {
  const { data, error } = await supabase
    .from("agents")
    .select("slug")
    .eq("user_id", userId)
    .like("slug", `${baseSlug}%`);

  if (error) {
    throw error;
  }

  return (data || []).map((item) => item.slug);
}

function buildMetadata(
  input: CreateAgentInput,
  workspacePath: string,
  agentDirPath: string,
  openClawAgentId: string
): AgentMetadata {
  const baseMetadata = input.metadataJson || {};
  const config = getOpenClawConfig();

  return {
    ...baseMetadata,
    openclaw: {
      syncMode: config.syncMode,
      profile: config.profile || null,
      workspacePath,
      agentDirPath,
      agentId: openClawAgentId,
    },
    futureBinding: {
      bindingKey: input.bindingKey || null,
      accountId: input.accountId || null,
    },
  };
}

async function updateAgentRecord(
  supabase: SupabaseClient,
  agentId: string,
  patch: Partial<AgentRecord>
) {
  const { data, error } = await supabase
    .from("agents")
    .update(patch)
    .eq("id", agentId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as AgentRecord;
}

export async function createAgent(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAgentInput
): Promise<CreateAgentResult> {
  return withSpan("agents.create", async (span) => {
    const config = getOpenClawConfig();
    const baseSlug = createAgentSlug(input.name);
    const existingSlugs = await getExistingSlugs(supabase, userId, baseSlug);
    const slug = buildUniqueSlug(baseSlug, existingSlugs);
    const workspacePath = buildAgentWorkspacePath(
      config.workspacesRoot,
      userId,
      slug
    );
    const agentDirPath = buildOpenClawAgentDirPath(
      config.agentStateRoot,
      userId,
      slug
    );
    const openClawAgentId = buildOpenClawAgentId(userId, slug);
    const metadataJson = buildMetadata(
      input,
      workspacePath,
      agentDirPath,
      openClawAgentId
    );
    const initialStatus =
      config.syncMode === "immediate" ? "provisioning" : "sync_pending";

    span.setAttribute("agent.slug", slug);
    span.setAttribute("agent.user_id", userId);
    span.setAttribute("openclaw.sync_mode", config.syncMode);
    span.setAttribute("openclaw.agent_id", openClawAgentId);

    const { data, error } = await supabase
      .from("agents")
      .insert({
        user_id: userId,
        name: input.name,
        slug,
        status: initialStatus,
        workspace_path: workspacePath,
        openclaw_agent_id: openClawAgentId,
        binding_key: input.bindingKey || null,
        metadata_json: metadataJson,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    let agent = data as AgentRecord;

    logger.info(
      {
        agentId: agent.id,
        userId,
        openClawAgentId,
        syncMode: config.syncMode,
      },
      "Agent persisted in application database"
    );

    if (config.syncMode === "deferred") {
      return {
        agent,
        sync: {
          mode: "deferred",
          state: "pending",
        },
      };
    }

    const correlationId = generateCorrelationId();
    const waStatus = await getWhatsAppStatus();

    const provisionJob = await enqueueAgentProvision(
      {
        agentId: agent.id,
        userId,
        openClawAgentId,
        displayName: input.name,
        workspacePath,
        agentDirPath,
        correlationId,
        whatsappAccount: waStatus.linked ? waStatus.accountName : undefined,
      },
      { idempotencyKey: `agent-${agent.id}`, correlationId }
    );

    logger.info(
      { agentId: agent.id, openClawAgentId, correlationId, jobId: provisionJob.id },
      "Agent provision job enqueued"
    );

    return {
      agent,
      sync: {
        mode: "immediate",
        state: "pending",
        jobId: provisionJob.id,
      },
    };
  });
}
