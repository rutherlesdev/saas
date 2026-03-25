import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  createSupabaseRouteClient: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseRouteClient: mocks.createSupabaseRouteClient,
}));

import { GET } from "@/app/auth/callback/route";

describe("GET /auth/callback", () => {
  beforeEach(() => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.createSupabaseRouteClient.mockReturnValue({
      auth: {
        exchangeCodeForSession: mocks.exchangeCodeForSession,
      },
    });
  });

  it("exchanges the code and redirects to the requested in-app path", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/auth/callback?code=test-code&next=%2Fdashboard%2Fagents"
      )
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard/agents"
    );
  });

  it("falls back to the default path when next is external", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/auth/callback?code=test-code&next=https://evil.example"
      )
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard"
    );
  });

  it("redirects to login when code exchange fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: new Error("exchange failed"),
    });

    const response = await GET(
      new NextRequest("http://localhost:3000/auth/callback?code=bad-code")
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=auth_callback_failed"
    );
  });
});
