"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function EmbedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[embed]", error);
  }, [error]);

  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">
        Das Formular konnte nicht geladen werden.
      </p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Bitte erneut versuchen. Wenn das Problem bleibt, die Seite neu laden
        oder das Restaurant direkt kontaktieren.
      </p>
      <Button type="button" size="sm" className="rounded-xl" onClick={() => reset()}>
        Erneut versuchen
      </Button>
    </div>
  );
}
