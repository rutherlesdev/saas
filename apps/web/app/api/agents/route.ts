import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createAgentSchema } from "@/lib/agents/schema";
import { withSpan } from "@/lib/observability/tracing";
import {
  clearCorrelationId,
  ensureCorrelationId,
} from "@/lib/queue/observability/correlation";
import { getLogger } from "@/lib/queue/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createAgent } from "@/services/agents/create-agent";

export const runtime = "nodejs";

const logger = getLogger();

function isConflictError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "23505" || maybeError.message?.includes("duplicate") === true;
}

export async function POST(request: NextRequest) {
  const correlationContext = `api-agents:${randomUUID()}`;
  const correlationId = ensureCorrelationId(correlationContext);

  try {
    return await withSpan("api.agents.create", async (span) => {
      span.setAttribute("correlation.id", correlationId);

      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        logger.warn({ correlationId }, "Unauthorized attempt to create agent");

        return NextResponse.json(
          { error: "Usuário não autenticado" },
          {
            status: 401,
            headers: { "x-correlation-id": correlationId },
          }
        );
      }

      let body: unknown;

      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "JSON inválido" },
          {
            status: 400,
            headers: { "x-correlation-id": correlationId },
          }
        );
      }

      const parsed = createAgentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Dados inválidos para criar agente",
            issues: parsed.error.flatten(),
          },
          {
            status: 400,
            headers: { "x-correlation-id": correlationId },
          }
        );
      }

      logger.info(
        {
          correlationId,
          userId: user.id,
          agentName: parsed.data.name,
        },
        "Creating agent via API"
      );

      const result = await createAgent(supabase, user.id, parsed.data);

      return NextResponse.json(result, {
        status: 201,
        headers: { "x-correlation-id": correlationId },
      });
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Falha ao criar agente";

    logger.error(
      { correlationId, error: errorMessage },
      "Agent creation failed"
    );

    return NextResponse.json(
      { error: isConflictError(error) ? "Já existe um agente com esse identificador" : errorMessage },
      {
        status: isConflictError(error) ? 409 : 500,
        headers: { "x-correlation-id": correlationId },
      }
    );
  } finally {
    clearCorrelationId(correlationContext);
  }
}
