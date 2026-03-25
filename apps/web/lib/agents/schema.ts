import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const createAgentSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres").max(80, "Use no máximo 80 caracteres"),
  bindingKey: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(2).max(120).optional()
  ),
  accountId: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(2).max(120).optional()
  ),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});

export type CreateAgentSchema = z.infer<typeof createAgentSchema>;
