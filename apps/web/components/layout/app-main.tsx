import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Einheitliche Content-Breite für Dashboard, Einstellungen, Bestand, Speisekarte. */
export function AppMain({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="bg-background">
      <main
        className={cn(
          "mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
