import type { ReactNode } from "react";
import {
  appContentPxClassName,
  appMobileContentPbClassName,
} from "@/lib/ui/app-mobile-bottom-nav";
import { cn } from "@/lib/utils";

/** Einheitliches Content-Padding für Dashboard, Einstellungen, Bestand, Speisekarte — volle Breite im Main-Bereich. */
export function AppMain({
  children,
  className,
  wrapperClassName,
}: {
  children: ReactNode;
  className?: string;
  /** Optional — z. B. `h-full` für Desktop-Split-Module (Nachrichten). */
  wrapperClassName?: string;
}) {
  return (
    <div className={wrapperClassName}>
      <main
        className={cn(
          "w-full pt-4",
          appContentPxClassName,
          appMobileContentPbClassName,
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
