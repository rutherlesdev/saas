import type { CSSProperties } from "react";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppManager } from "@/components/whatsapp/whatsapp-manager";
import { getWhatsAppStatus } from "@/lib/openclaw/channels";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const status = await getWhatsAppStatus();

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
        <SiteHeader title="WhatsApp" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <WhatsAppManager initialStatus={status} />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
