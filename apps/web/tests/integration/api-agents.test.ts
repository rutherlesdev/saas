import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  createAgent: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/services/agents/create-agent", () => ({
  createAgent: mocks.createAgent,
}));

vi.mock("@/lib/queue/observability/correlation", () => ({
  ensureCorrelationId: vi.fn(() => "jq-test-correlation"),
  clearCorrelationId: vi.fn(),
}));

vi.mock("@/lib/queue/observability/logger", () => {
  const noopLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };

  return {
    getLogger: vi.fn(() => noopLogger),
    createContextLogger: vi.fn(() => noopLogger),
  };
});

import { POST } from "@/app/api/agents/route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/agents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/agents", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
    });

    mocks.createAgent.mockResolvedValue({
      agent: {
        id: "agent-row-1",
        user_id: "user-123",
        name: "Agente Suporte",
        slug: "agente-suporte",
        status: "ready",
        workspace_path: "/data/openclaw/workspaces/user-123/agente-suporte",
        openclaw_agent_id: "agent-user-123-agente-suporte",
        binding_key: "whatsapp-main",
        metadata_json: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      sync: {
        mode: "immediate",
        state: "ready",
      },
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await POST(makeRequest({ name: "Agente" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when the payload is invalid", async () => {
    const response = await POST(makeRequest({ name: "A" }));
    expect(response.status).toBe(400);
  });

  it("creates the agent and returns 201", async () => {
    const response = await POST(
      makeRequest({
        name: "Agente Suporte",
        bindingKey: "whatsapp-main",
        accountId: "5511999999999",
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.createAgent).toHaveBeenCalledWith(
      expect.anything(),
      "user-123",
      expect.objectContaining({
        name: "Agente Suporte",
        bindingKey: "whatsapp-main",
        accountId: "5511999999999",
      })
    );

    const body = await response.json();
    expect(body.agent.slug).toBe("agente-suporte");
    expect(response.headers.get("x-correlation-id")).toBe(
      "jq-test-correlation"
    );
  });

  it("returns 409 when the create service raises a uniqueness conflict", async () => {
    mocks.createAgent.mockRejectedValue({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });

    const response = await POST(makeRequest({ name: "Agente Suporte" }));
    expect(response.status).toBe(409);
  });
});
