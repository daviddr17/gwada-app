import type { ReactNode } from "react";
import { appMobileContentPbClassName } from "@/lib/ui/app-mobile-bottom-nav";
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
    <div>
      <main
        className={cn(
          "w-full px-4 pt-4 sm:px-6",
          appMobileContentPbClassName,
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
