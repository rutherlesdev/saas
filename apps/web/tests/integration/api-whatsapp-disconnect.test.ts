import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  disconnectWhatsApp: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/openclaw/channels", () => ({
  disconnectWhatsApp: mocks.disconnectWhatsApp,
}));

import { POST } from "@/app/api/whatsapp/disconnect/route";

describe("POST /api/whatsapp/disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
    });

    mocks.disconnectWhatsApp.mockResolvedValue(undefined);
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await POST();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Não autorizado" });
  });

  it("returns 200 when the logout succeeds", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.disconnectWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when the cleanup fails", async () => {
    mocks.disconnectWhatsApp.mockRejectedValue(new Error("logout failed"));

    const response = await POST();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "logout failed" });
  });
});
