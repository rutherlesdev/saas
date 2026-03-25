import { NextRequest, NextResponse } from "next/server";

import {
  DEFAULT_AUTH_REDIRECT_PATH,
  sanitizeAuthRedirectPath,
} from "@/lib/auth/redirects";
import { createSupabaseRouteClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

function getRedirectOrigin(request: NextRequest, origin: string) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (!isLocalEnv && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return origin;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeAuthRedirectPath(
    searchParams.get("next"),
    DEFAULT_AUTH_REDIRECT_PATH
  );
  const baseOrigin = getRedirectOrigin(request, origin);

  if (!code) {
    return NextResponse.redirect(`${baseOrigin}/login?error=missing_auth_code`);
  }

  const response = NextResponse.redirect(`${baseOrigin}${next}`);
  const supabase = createSupabaseRouteClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${baseOrigin}/login?error=auth_callback_failed`);
  }

  return response;
}
