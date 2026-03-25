import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execFileAsync: vi.fn(),
  access: vi.fn(),
  rm: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn(() => mocks.execFileAsync),
}));

vi.mock("node:fs/promises", () => ({
  access: mocks.access,
  rm: mocks.rm,
}));

import { disconnectWhatsApp } from "@/lib/openclaw/channels";

describe("disconnectWhatsApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = "/tmp/openclaw-home";
    process.env.OPENCLAW_BIN = "openclaw";
    delete process.env.OPENCLAW_PROFILE;
    delete process.env.OPENCLAW_WHATSAPP_ACCOUNT;
  });

  it("uses channels logout for the configured account", async () => {
    process.env.OPENCLAW_WHATSAPP_ACCOUNT = "work";
    mocks.execFileAsync.mockResolvedValue({ stdout: "", stderr: "" });
    mocks.access.mockRejectedValue(new Error("ENOENT"));

    await expect(disconnectWhatsApp()).resolves.toBeUndefined();

    expect(mocks.execFileAsync).toHaveBeenCalledWith(
      "openclaw",
      [
        "channels",
        "logout",
        "--channel",
        "whatsapp",
        "--account",
        "work",
      ],
      expect.objectContaining({
        env: process.env,
        timeout: 30_000,
      })
    );
    expect(mocks.rm).not.toHaveBeenCalled();
  });

  it("removes the local auth directory when logout leaves auth state behind", async () => {
    process.env.OPENCLAW_WHATSAPP_ACCOUNT = "work";
    mocks.execFileAsync.mockResolvedValue({ stdout: "", stderr: "" });
    mocks.access
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("ENOENT"));
    mocks.rm.mockResolvedValue(undefined);

    await expect(disconnectWhatsApp()).resolves.toBeUndefined();

    expect(mocks.rm).toHaveBeenCalledWith(
      "/tmp/openclaw-home/.openclaw/credentials/whatsapp/work",
      {
        recursive: true,
        force: true,
      }
    );
  });

  it("is idempotent when logout fails but auth state is already gone", async () => {
    mocks.execFileAsync.mockRejectedValue(new Error("already logged out"));
    mocks.access.mockRejectedValue(new Error("ENOENT"));

    await expect(disconnectWhatsApp()).resolves.toBeUndefined();
    expect(mocks.rm).not.toHaveBeenCalled();
  });

  it("throws when auth state still exists after logout and fallback cleanup", async () => {
    process.env.OPENCLAW_WHATSAPP_ACCOUNT = "work";
    const logoutError = new Error("logout failed");
    mocks.execFileAsync.mockRejectedValue(logoutError);
    mocks.access.mockResolvedValue(undefined);
    mocks.rm.mockResolvedValue(undefined);

    await expect(disconnectWhatsApp()).rejects.toThrow("logout failed");
    expect(mocks.rm).toHaveBeenCalledTimes(1);
  });
});
