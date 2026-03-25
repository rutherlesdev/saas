import { describe, expect, it } from "vitest";

import {
  getMissingAgentsTableMessage,
  isMissingAgentsTableError,
} from "@/lib/agents/supabase-errors";

describe("agent supabase errors", () => {
  it("detects the postgrest schema cache error for public.agents", () => {
    expect(
      isMissingAgentsTableError({
        code: "PGRST205",
        message:
          "Could not find the table 'public.agents' in the schema cache",
      })
    ).toBe(true);
  });

  it("detects postgres relation errors for the agents table", () => {
    expect(
      isMissingAgentsTableError({
        code: "42P01",
        message: 'relation "agents" does not exist',
      })
    ).toBe(true);
  });

  it("ignores unrelated database errors", () => {
    expect(
      isMissingAgentsTableError({
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
      })
    ).toBe(false);
  });

  it("returns a recovery message that points to the migration", () => {
    expect(getMissingAgentsTableMessage()).toContain("public.agents");
    expect(getMissingAgentsTableMessage()).toContain("migration");
  });
});
