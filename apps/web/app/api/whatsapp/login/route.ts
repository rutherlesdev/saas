import { spawn } from "node:child_process";

import type { NextRequest } from "next/server";

import { getOpenClawConfig, getOpenClawGlobalArgs } from "@/lib/openclaw/config";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { enqueueWhatsAppConnect } from "@/lib/queue/producers";

export const runtime = "nodejs";

const QR_CHAR_PATTERN = /[█▄▀]/;
const LOGIN_TIMEOUT_MS = 120_000;
const IS_DEV = process.env.NODE_ENV === "development";

function encodeSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const config = getOpenClawConfig();
  const accountName = process.env.OPENCLAW_WHATSAPP_ACCOUNT || "default";
  const args = [
    ...getOpenClawGlobalArgs(config),
    "channels",
    "login",
    "--channel",
    "whatsapp",
    "--account",
    accountName,
  ];

  let streamController: ReadableStreamDefaultController<Uint8Array> | null =
    null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      streamController = ctrl;
    },
    cancel() {
      closed = true;
    },
  });

  const send = (event: string, data: unknown) => {
    if (closed || !streamController) return;
    try {
      streamController.enqueue(encoder.encode(encodeSSE(event, data)));
    } catch {
      // stream already closed
    }
  };

  const close = () => {
    if (closed || !streamController) return;
    closed = true;
    try {
      streamController.close();
    } catch {
      // ignore
    }
  };

  const proc = spawn(config.bin, args, {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const timeout = setTimeout(() => {
    send("error", { message: "Timeout: nenhum scan em 2 minutos" });
    proc.kill();
    close();
  }, LOGIN_TIMEOUT_MS);

  let qrBuffer: string[] = [];
  let inQrBlock = false;

  function processLine(line: string) {
    const trimmed = line.trim();

    if (IS_DEV) {
      send("debug", { line });
    }

    if (
      trimmed.toLowerCase().includes("scan this qr") ||
      trimmed.toLowerCase().includes("scan in whatsapp")
    ) {
      // Emit any existing buffer before starting a new QR block
      if (inQrBlock && qrBuffer.length > 2) {
        send("qr", { qr: qrBuffer.join("\n") });
      }
      inQrBlock = true;
      qrBuffer = [];
      return;
    }

    if (inQrBlock) {
      if (QR_CHAR_PATTERN.test(trimmed)) {
        qrBuffer.push(line);
      } else if (trimmed === "") {
        // blank line in the middle of a QR block is fine
        if (qrBuffer.length > 0) qrBuffer.push(line);
      } else {
        // Non-QR content: block is over, emit what we have
        if (qrBuffer.length > 2) {
          send("qr", { qr: qrBuffer.join("\n") });
        }
        inQrBlock = false;
        qrBuffer = [];
      }
    }

    const lower = trimmed.toLowerCase();
    if (
      lower.includes("connected") ||
      lower.includes("ready") ||
      lower.includes("logged in") ||
      lower.includes("whatsapp link") ||
      lower.includes("paired") ||
      lower.includes("authentication successful")
    ) {
      // Emit any buffered QR first
      if (qrBuffer.length > 2) {
        send("qr", { qr: qrBuffer.join("\n") });
      }
      send("connected", {});
      enqueueWhatsAppConnect({ userId: user!.id, accountName, event: "connected" }).catch(() => {});
      clearTimeout(timeout);
      proc.kill();
      close();
    }
  }

  const onData = (data: Buffer) => {
    const text = data.toString("utf8");
    for (const line of text.split("\n")) {
      processLine(line);
    }
    // Flush QR buffer at the end of each chunk: the process goes silent while
    // waiting for the scan, so no "end of block" line ever arrives.
    if (inQrBlock && qrBuffer.length > 2) {
      send("qr", { qr: qrBuffer.join("\n") });
    }
  };

  proc.stdout?.on("data", onData);
  proc.stderr?.on("data", onData);

  proc.on("close", (code) => {
    clearTimeout(timeout);
    if (!closed) {
      // Emit any trailing buffered QR
      if (qrBuffer.length > 2) {
        send("qr", { qr: qrBuffer.join("\n") });
      }
      if (code === 0) {
        send("connected", {});
      } else if (code !== null) {
        send("error", { message: `Processo encerrou com código ${code}` });
      }
      close();
    }
  });

  // Clean up if client disconnects
  request.signal.addEventListener("abort", () => {
    proc.kill();
    clearTimeout(timeout);
    closed = true;
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
