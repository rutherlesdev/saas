import { describe, expect, it } from "vitest";

import {
  buildEmailRedirectTo,
  DEFAULT_AUTH_REDIRECT_PATH,
  sanitizeAuthRedirectPath,
} from "@/lib/auth/redirects";

describe("auth redirects", () => {
  it("builds the callback URL with the default dashboard redirect", () => {
    expect(buildEmailRedirectTo("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/callback?next=%2Fdashboard"
    );
  });

  it("keeps safe relative redirects", () => {
    expect(sanitizeAuthRedirectPath("/dashboard/agents?tab=all")).toBe(
      "/dashboard/agents?tab=all"
    );
  });

  it("rejects external redirects", () => {
    expect(sanitizeAuthRedirectPath("https://evil.example")).toBe(
      DEFAULT_AUTH_REDIRECT_PATH
    );
  });
});
