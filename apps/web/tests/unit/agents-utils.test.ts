import { describe, expect, it } from "vitest";

import {
  buildAgentWorkspacePath,
  buildOpenClawAgentDirPath,
  buildOpenClawAgentId,
  buildUniqueSlug,
  createAgentSlug,
} from "@/lib/agents/utils";

describe("agent utils", () => {
  it("creates a normalized slug from the agent name", () => {
    expect(createAgentSlug("Atendimento WhatsApp Brasil")).toBe(
      "atendimento-whatsapp-brasil"
    );
    expect(createAgentSlug("  Agente   çom espaços  ")).toBe(
      "agente-com-espacos"
    );
  });

  it("builds a unique slug when the base slug already exists", () => {
    expect(
      buildUniqueSlug("agente", ["agente", "agente-2", "agente-3"])
    ).toBe("agente-4");
  });

  it("builds predictable workspace and agentDir paths", () => {
    expect(
      buildAgentWorkspacePath(
        "/data/openclaw/workspaces",
        "user-123",
        "agente-suporte"
      )
    ).toBe("/data/openclaw/workspaces/user-123/agente-suporte");

    expect(
      buildOpenClawAgentDirPath(
        "/data/openclaw/agents",
        "user-123",
        "agente-suporte"
      )
    ).toBe("/data/openclaw/agents/user-123/agente-suporte");
  });

  it("builds a globally unique openclaw agent id from user + slug", () => {
    expect(buildOpenClawAgentId("8b8ed4d4-7c32-4f0d-bf6b-d0f12f928765", "suporte"))
      .toBe("agent-8b8ed4d4-7c32-suporte");
  });
});
