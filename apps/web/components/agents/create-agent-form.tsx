"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OpenClawSyncMode } from "@/lib/agents/types";
import { Badge } from "@workspace/ui/components/badge";

interface CreateAgentResponse {
  agent?: {
    id: string;
    status: string;
  };
  sync?: {
    mode: OpenClawSyncMode;
    state: "ready" | "pending" | "failed";
    error?: string | null;
  };
  error?: string;
}

export function CreateAgentForm({
  syncMode,
}: {
  syncMode: OpenClawSyncMode;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [bindingKey, setBindingKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          bindingKey,
          accountId,
        }),
      });

      const payload = (await response.json()) as CreateAgentResponse;

      if (!response.ok) {
        setError(payload.error || "Não foi possível criar o agente.");
        return;
      }

      if (payload.sync?.state === "failed") {
        setError(
          `Agente salvo no sistema, mas a sincronização com o OpenClaw falhou: ${
            payload.sync.error || "erro desconhecido"
          }`
        );
      } else if (payload.sync?.state === "pending") {
        setSuccessMessage(
          "Agente salvo. A sincronização com o OpenClaw ficou pendente para execução posterior."
        );
      } else {
        setSuccessMessage(
          "Agente criado e provisionado no OpenClaw com workspace próprio."
        );
      }

      setName("");
      setBindingKey("");
      setAccountId("");
      startTransition(() => router.refresh());
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Falha inesperada ao criar agente."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card id="new-agent">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Criar agente</CardTitle>
          <CardDescription>
            Cada agente recebe um workspace próprio no OpenClaw e continua
            compartilhando o mesmo Gateway.
          </CardDescription>
        </div>
        <Badge variant="outline">
          OpenClaw sync: {syncMode === "immediate" ? "imediato" : "posterior"}
        </Badge>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="agent-name">Nome do agente</Label>
            <Input
              id="agent-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Atendimento WhatsApp"
              required
              maxLength={80}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="binding-key">Binding key futuro</Label>
              <Input
                id="binding-key"
                name="bindingKey"
                value={bindingKey}
                onChange={(event) => setBindingKey(event.target.value)}
                placeholder="Ex.: whatsapp-main"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="account-id">Account ID futuro</Label>
              <Input
                id="account-id"
                name="accountId"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                placeholder="Ex.: 5511999999999"
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Falha na criação</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {successMessage ? (
            <Alert>
              <AlertTitle>Agente registrado</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center justify-end">
            <Button disabled={submitting} type="submit">
              {submitting ? "Criando..." : "Criar agente"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
