export const DEFAULT_AUTH_REDIRECT_PATH = "/dashboard";

export function sanitizeAuthRedirectPath(
  redirectPath: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT_PATH
) {
  if (!redirectPath || !redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(redirectPath, "http://localhost");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buildEmailRedirectTo(
  origin: string,
  next = DEFAULT_AUTH_REDIRECT_PATH
) {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", sanitizeAuthRedirectPath(next));
  return url.toString();
}
