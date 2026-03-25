const MISSING_AGENTS_TABLE_PATTERNS = [
  "Could not find the table 'public.agents' in the schema cache",
  'relation "public.agents" does not exist',
  'relation "agents" does not exist',
];

const MISSING_AGENTS_TABLE_MESSAGE =
  "A tabela `public.agents` ainda nao existe no banco configurado. Aplique a migration do Supabase deste ambiente e recarregue a dashboard.";

interface SupabaseLikeError {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
}

export function isMissingAgentsTableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as SupabaseLikeError;
  const errorText = [maybeError.message, maybeError.details, maybeError.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return (
    (maybeError.code === "PGRST205" && errorText.includes("public.agents")) ||
    (maybeError.code === "42P01" &&
      MISSING_AGENTS_TABLE_PATTERNS.some((pattern) =>
        errorText.includes(pattern)
      )) ||
    MISSING_AGENTS_TABLE_PATTERNS.some((pattern) => errorText.includes(pattern))
  );
}

export function getMissingAgentsTableMessage() {
  return MISSING_AGENTS_TABLE_MESSAGE;
}
