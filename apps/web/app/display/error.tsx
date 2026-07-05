"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

export default function DisplayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    console.error("[display]", pathname, error);
  }, [error, pathname]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold text-foreground">
        Display konnte nicht geladen werden.
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Bitte erneut versuchen. Falls der Fehler nach der PIN-Anmeldung auftritt,
        Seite neu laden und nochmals anmelden.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          size="lg"
          className={cn("rounded-xl", brandActionButtonRoundedClassName)}
          onClick={() => reset()}
        >
          Erneut versuchen
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="rounded-xl"
          onClick={() => window.location.assign(pathname || "/display/pair")}
        >
          Seite neu laden
        </Button>
      </div>
    </div>
  );
}
