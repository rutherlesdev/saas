import { redirect } from "next/navigation";
import { BotIcon } from "lucide-react";

import { CreateAgentForm } from "@/components/agents/create-agent-form";
import { AgentsTable } from "@/components/agents/agents-table";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import type { AgentRecord } from "@/lib/agents/types";
import { getOpenClawConfig } from "@/lib/openclaw/config";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

export default async function AgentsDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const config = getOpenClawConfig();
  const agents = (data || []) as AgentRecord[];

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Agents" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <Card>
                  <CardContent className="flex flex-col gap-3 py-6 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <BotIcon className="size-4 text-primary" />
                        <h2 className="text-lg font-semibold">
                          Agentes no mesmo Gateway OpenClaw
                        </h2>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Cada agente usa workspace e agentDir próprios, enquanto o
                        roteamento multi-agent continua no mesmo Gateway.
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Sync atual:{" "}
                      <span className="font-medium text-foreground">
                        {config.syncMode === "immediate"
                          ? "criação imediata no OpenClaw"
                          : "persistir agora e sincronizar depois"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="px-4 lg:px-6">
                <Alert>
                  <AlertTitle>Modelo adotado nesta entrega</AlertTitle>
                  <AlertDescription>
                    Gateway único, agentes múltiplos e bindings futuros por
                    canal. O `openclaw_agent_id` é derivado de usuário + slug
                    para evitar colisão global no mesmo Gateway.
                  </AlertDescription>
                </Alert>
              </div>

              <div className="grid gap-4 px-4 lg:px-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <CreateAgentForm syncMode={config.syncMode} />
                <AgentsTable agents={agents} />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
