import path from "node:path";

function normalizePathSegment(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "agent";
}

export function createAgentSlug(name: string) {
  return normalizePathSegment(name).slice(0, 48) || "agent";
}

export function buildUniqueSlug(baseSlug: string, existingSlugs: string[]) {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existingSlugs.includes(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

export function buildAgentWorkspacePath(root: string, userId: string, slug: string) {
  return path.posix.join(root, normalizePathSegment(userId), slug);
}

export function buildOpenClawAgentDirPath(root: string, userId: string, slug: string) {
  return path.posix.join(root, normalizePathSegment(userId), slug);
}

export function buildOpenClawAgentId(userId: string, slug: string) {
  const userSegment = normalizePathSegment(userId).slice(0, 13);
  return `agent-${userSegment}-${slug}`.slice(0, 72);
}
