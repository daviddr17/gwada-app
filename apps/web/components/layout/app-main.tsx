import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Einheitliches Content-Padding für Dashboard, Einstellungen, Bestand, Speisekarte — volle Breite im Main-Bereich. */
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
          "w-full px-4 pb-16 pt-4 sm:px-6",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
