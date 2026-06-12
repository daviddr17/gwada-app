"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-foreground">
        Dashboard konnte nicht geladen werden.
      </p>
      <p className="max-w-md text-xs text-muted-foreground">
        Bitte erneut laden. Bei wiederholten Fehlern die Seite neu öffnen.
        {error.digest ? (
          <span className="mt-2 block font-mono text-[10px] opacity-70">
            {error.digest}
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          onClick={() => {
            router.refresh();
            reset();
          }}
        >
          Erneut versuchen
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={() => window.location.assign("/dashboard")}
        >
          Dashboard neu laden
        </Button>
      </div>
    </div>
  );
}
