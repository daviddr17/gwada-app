"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DashboardZoneError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.error("[dashboard:zone]", pathname, error);
  }, [error, pathname]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-foreground">
        Dieser Bereich konnte nicht geladen werden.
      </p>
      <p className="max-w-md text-xs text-muted-foreground">
        Bitte erneut laden. Bei wiederholten Fehlern die Seite neu öffnen.
        {error.message ? (
          <span className="mt-2 block font-mono text-[10px] opacity-70">
            {error.message.slice(0, 160)}
          </span>
        ) : null}
        {error.digest ? (
          <span className="mt-1 block font-mono text-[10px] opacity-70">
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
          onClick={() => window.location.assign(pathname || "/dashboard")}
        >
          Seite neu laden
        </Button>
      </div>
    </div>
  );
}
