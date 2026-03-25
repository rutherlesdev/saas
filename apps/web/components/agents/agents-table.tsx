import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AgentRecord, AgentStatus } from "@/lib/agents/types";
import { Badge } from "@workspace/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

function getStatusVariant(status: AgentStatus) {
  switch (status) {
    case "ready":
      return "default";
    case "sync_failed":
      return "destructive";
    case "provisioning":
      return "secondary";
    case "sync_pending":
    default:
      return "outline";
  }
}

function getStatusLabel(status: AgentStatus) {
  switch (status) {
    case "ready":
      return "Pronto";
    case "sync_failed":
      return "Falha no sync";
    case "provisioning":
      return "Provisionando";
    case "sync_pending":
    default:
      return "Pendente";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function readMetadataText(agent: AgentRecord, key: "accountId" | "identityWarning" | "lastError") {
  const metadata = (agent.metadata_json || {}) as Record<string, unknown>;
  const openclaw = (metadata.openclaw || {}) as Record<string, unknown>;
  const futureBinding = (metadata.futureBinding || {}) as Record<string, unknown>;

  if (key === "accountId") {
    const value = futureBinding.accountId;
    return typeof value === "string" ? value : null;
  }

  const value = openclaw[key];
  return typeof value === "string" ? value : null;
}

export function AgentsTable({ agents }: { agents: AgentRecord[] }) {
  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhum agente ainda</CardTitle>
          <CardDescription>
            Crie o primeiro agente para provisionar um workspace dedicado no
            OpenClaw e preparar o binding futuro de canais.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agentes cadastrados</CardTitle>
        <CardDescription>
          Lista simples com status do app, identificador do OpenClaw e caminho
          do workspace por agente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>OpenClaw</TableHead>
              <TableHead>Binding futuro</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{agent.name}</span>
                    {readMetadataText(agent, "identityWarning") ? (
                      <span className="text-xs text-muted-foreground">
                        Identity parcial: {readMetadataText(agent, "identityWarning")}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{agent.slug}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(agent.status)}>
                    {getStatusLabel(agent.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span>{agent.openclaw_agent_id || "—"}</span>
                    {readMetadataText(agent, "lastError") ? (
                      <span className="max-w-[280px] whitespace-normal break-words text-xs text-destructive">
                        {readMetadataText(agent, "lastError")}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span>{agent.binding_key || "—"}</span>
                    <span className="text-xs text-muted-foreground">
                      account: {readMetadataText(agent, "accountId") || "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="max-w-[340px] whitespace-normal break-all text-xs text-muted-foreground">
                  {agent.workspace_path}
                </TableCell>
                <TableCell>{formatDate(agent.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Alert>
          <AlertTitle>Boundary de segurança</AlertTitle>
          <AlertDescription>
            Este fluxo assume usuários do mesmo sistema em ambiente confiável.
            O workspace separado do OpenClaw organiza cada agente, mas não é um
            boundary forte para usuários mutuamente não confiáveis.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
