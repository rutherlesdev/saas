"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Algo deu errado</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
      <Button onClick={reset} type="button">
        Tentar novamente
      </Button>
    </div>
  );
}
