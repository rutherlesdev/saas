import { describe, expect, it } from "vitest";

import { extractJsonPayload } from "@/lib/openclaw/json";

describe("extractJsonPayload", () => {
  it("extracts a JSON object from noisy output", () => {
    const output = [
      "Some warning before JSON",
      '{',
      '  "agentId": "agent-1",',
      '  "workspace": "/tmp/ws"',
      "}",
    ].join("\n");

    expect(
      extractJsonPayload<{ agentId: string; workspace: string }>(output)
    ).toEqual({
      agentId: "agent-1",
      workspace: "/tmp/ws",
    });
  });

  it("extracts a JSON array even with trailing logs", () => {
    const output = [
      "[",
      '  { "id": "main" },',
      '  { "id": "agent-1" }',
      "]",
      "[agents/auth-profiles] synced credentials",
    ].join("\n");

    expect(extractJsonPayload<Array<{ id: string }>>(output)).toEqual([
      { id: "main" },
      { id: "agent-1" },
    ]);
  });
});
