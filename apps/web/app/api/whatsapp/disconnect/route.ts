import { NextResponse } from "next/server";

import { disconnectWhatsApp } from "@/lib/openclaw/channels";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    await disconnectWhatsApp();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao desconectar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
