"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2Icon,
  Loader2Icon,
  MessageCircleIcon,
  RefreshCwIcon,
  WifiOffIcon,
  XCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WhatsAppStatus } from "@/lib/openclaw/channels";
import { QrCodeSvg } from "@/lib/whatsapp/qr-utils";

const IS_DEV = process.env.NODE_ENV === "development";

type ConnectionState = "idle" | "connecting" | "qr_ready" | "connected" | "error";

interface WhatsAppManagerProps {
  initialStatus: WhatsAppStatus;
}

export function WhatsAppManager({ initialStatus }: WhatsAppManagerProps) {
  const [status, setStatus] = useState<WhatsAppStatus>(initialStatus);
  const [connState, setConnState] = useState<ConnectionState>("idle");
  const [qrAscii, setQrAscii] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const debugEndRef = useRef<HTMLDivElement | null>(null);

  const esRef = useRef<EventSource | null>(null);
  // Tracks whether a terminal SSE event (connected/error) was already received.
  // Prevents es.onerror — which fires when the server closes the stream — from
  // clobbering state after a successful connection.
  const sseTerminatedRef = useRef(false);

  const closeEventSource = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const startLogin = useCallback(() => {
    closeEventSource();
    sseTerminatedRef.current = false;
    setConnState("connecting");
    setQrAscii(null);
    setErrorMsg(null);
    setDebugLines([]);

    const es = new EventSource("/api/whatsapp/login");
    esRef.current = es;

    if (IS_DEV) {
      es.addEventListener("debug", (e) => {
        const data = JSON.parse((e as MessageEvent).data) as { line: string };
        setDebugLines((prev) => [...prev, data.line]);
      });
    }

    es.addEventListener("qr", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { qr: string };
      setQrAscii(data.qr);
      setConnState("qr_ready");
    });

    es.addEventListener("connected", () => {
      sseTerminatedRef.current = true;
      setConnState("connected");
      setStatus((prev) => ({ ...prev, linked: true }));
      closeEventSource();
    });

    es.addEventListener("error", (e) => {
      sseTerminatedRef.current = true;
      try {
        const data = JSON.parse((e as MessageEvent).data) as {
          message?: string;
        };
        setErrorMsg(data.message ?? "Erro desconhecido");
      } catch {
        // not a data error event
      }
      setConnState("error");
      closeEventSource();
    });

    es.onerror = () => {
      // onerror fires when the server closes the SSE stream (including after a
      // successful connection). Only treat it as an error if no terminal event
      // was received yet.
      if (!sseTerminatedRef.current) {
        setConnState("error");
        setErrorMsg("Conexão SSE perdida");
      }
      closeEventSource();
    };
  }, [closeEventSource]);

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    closeEventSource();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15_000);
    try {
      const res = await fetch("/api/whatsapp/disconnect", {
        method: "POST",
        signal: abort.signal,
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Falha ao desconectar");
      }
      setStatus((prev) => ({ ...prev, linked: false }));
      setConnState("idle");
      setQrAscii(null);
      setErrorMsg(null);
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === "AbortError" ? "Timeout ao desconectar" : err.message)
        : "Erro ao desconectar";
      setErrorMsg(msg);
      setConnState("error");
    } finally {
      clearTimeout(timer);
      setIsDisconnecting(false);
    }
  }, [closeEventSource]);

  const handleReconnect = useCallback(async () => {
    setIsDisconnecting(true);
    closeEventSource();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15_000);
    try {
      if (status.linked || connState === "connected") {
        const res = await fetch("/api/whatsapp/disconnect", {
          method: "POST",
          signal: abort.signal,
        });
        if (!res.ok) {
          const body = await res.json() as { error?: string };
          throw new Error(body.error ?? "Falha ao desconectar");
        }
        setStatus((prev) => ({ ...prev, linked: false }));
      }
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === "AbortError" ? "Timeout ao desconectar" : err.message)
        : "Erro ao preparar reconexão";
      setErrorMsg(msg);
      setConnState("error");
      setIsDisconnecting(false);
      clearTimeout(timer);
      return;
    }
    clearTimeout(timer);
    setIsDisconnecting(false);
    startLogin();
  }, [closeEventSource, connState, startLogin, status.linked]);

  useEffect(() => {
    return () => closeEventSource();
  }, [closeEventSource]);

  useEffect(() => {
    if (IS_DEV) {
      debugEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [debugLines]);

  const isLinked = status.linked || connState === "connected";
  const isBusy =
    isDisconnecting ||
    connState === "connecting" ||
    connState === "qr_ready";

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <MessageCircleIcon className="size-5 text-primary" />
          <CardTitle>Canal WhatsApp</CardTitle>
          {isLinked ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Conectado
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Desconectado
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Status summary */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
          {isLinked ? (
            <>
              <CheckCircle2Icon className="size-5 shrink-0 text-green-500" />
              <div>
                <p className="text-sm font-medium">WhatsApp vinculado</p>
                <p className="text-xs text-muted-foreground">
                  Conta:{" "}
                  <span className="font-mono">{status.accountName}</span>
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircleIcon className="size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Não vinculado</p>
                <p className="text-xs text-muted-foreground">
                  Escaneie o QR code para conectar
                </p>
              </div>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {isLinked ? (
            <>
              <Button
                variant="outline"
                onClick={handleReconnect}
                disabled={isBusy}
              >
                {isDisconnecting ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <RefreshCwIcon className="size-4" />
                )}
                Reconectar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={isBusy}
              >
                {isDisconnecting ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <WifiOffIcon className="size-4" />
                )}
                Desconectar
              </Button>
            </>
          ) : (
            <Button onClick={startLogin} disabled={isBusy}>
              {isBusy ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <MessageCircleIcon className="size-4" />
              )}
              {connState === "connecting"
                ? "Iniciando..."
                : "Conectar WhatsApp"}
            </Button>
          )}
        </div>

        {/* QR code display */}
        {(connState === "connecting" || connState === "qr_ready") && (
          <div className="rounded-lg border bg-black p-5">
            {connState === "connecting" && !qrAscii ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-white/60">
                <Loader2Icon className="size-8 animate-spin" />
                <p className="text-sm">Aguardando QR code...</p>
              </div>
            ) : qrAscii ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-white/60">
                  Abra o WhatsApp → Dispositivos vinculados → Conectar
                </p>
                <QrCodeSvg qrText={qrAscii} size={280} />
                <p className="text-xs text-white/40">
                  O QR code se renova automaticamente a cada ~20s
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* Connected success */}
        {connState === "connected" && (
          <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <CheckCircle2Icon className="size-5 shrink-0 text-green-500" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                WhatsApp conectado com sucesso!
              </p>
              <p className="text-xs text-muted-foreground">
                O gateway já pode receber e enviar mensagens.
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {connState === "error" && errorMsg && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <XCircleIcon className="size-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Erro na conexão
              </p>
              <p className="text-xs text-muted-foreground">{errorMsg}</p>
            </div>
            <Button variant="outline" size="sm" onClick={startLogin}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Dev-mode process log */}
        {IS_DEV && debugLines.length > 0 && (
          <details className="rounded-lg border border-dashed">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              Debug — saída do processo ({debugLines.length} linhas)
            </summary>
            <div className="max-h-48 overflow-y-auto bg-black/90 px-3 py-2">
              {debugLines.map((line, i) => (
                <p key={i} className="font-mono text-[11px] leading-snug text-green-400">
                  {line}
                </p>
              ))}
              <div ref={debugEndRef} />
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
