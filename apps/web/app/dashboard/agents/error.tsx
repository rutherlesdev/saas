"use client";

import { Button } from "@/components/ui/button";

export default function AgentsErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Falha ao carregar agentes</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
      <Button onClick={reset} type="button">
        Tentar novamente
      </Button>
    </div>
  );
}
