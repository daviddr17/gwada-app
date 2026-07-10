"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { DashboardGlobalSearchOverlay } from "@/components/search/dashboard-global-search-overlay";
import { Button } from "@/components/ui/button";
import {
  DashboardGlobalSearchProvider,
  isRestaurantDashboardPath,
  useDashboardGlobalSearchOptional,
} from "@/lib/contexts/dashboard-global-search-context";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

function DashboardGlobalSearchTrigger() {
  const pathname = usePathname();
  const search = useDashboardGlobalSearchOptional();
  const show = isRestaurantDashboardPath(pathname);

  if (!show || !search) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "flex h-8 shrink-0 gap-2 rounded-full border-border/60 bg-card/70 px-3 text-muted-foreground shadow-none sm:inline-flex",
        "hover:bg-card hover:text-foreground",
      )}
      aria-label="Globale Suche öffnen"
      onClick={search.openSearch}
    >
      <Search className="size-3.5" />
      <span className="text-sm">Suchen</span>
      <kbd className="hidden rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline">
        ⌘K
      </kbd>
    </Button>
  );
}

export function DashboardGlobalSearchChrome({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DashboardGlobalSearchProvider>
      {children}
      <DashboardGlobalSearchOverlay />
    </DashboardGlobalSearchProvider>
  );
}

export { DashboardGlobalSearchTrigger };
