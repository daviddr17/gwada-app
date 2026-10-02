"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  moduleSearchFieldWrapClassName,
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonClassName,
  moduleSearchFilterButtonWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";

export function usePlatformAnalytics<T>(url: string) {
  const query = useQuery({
    queryKey: ["platform-analytics", url],
    queryFn: async ({ signal }) => {
      const response = await fetch(url, { cache: "no-store", signal });
      const body = (await response.json().catch(() => ({}))) as T & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "load_failed");
      }
      return body;
    },
    staleTime: 15_000,
  });

  const error =
    query.error instanceof Error
      ? query.error.message
      : query.isError
        ? "load_failed"
        : null;

  useEffect(() => {
    if (error === "query_failed" || error === "load_failed") {
      toast.error("Statistik konnte nicht geladen werden.");
    }
  }, [error]);

  return {
    data: query.data ?? null,
    error,
    loading: query.isPending,
    busy: query.isFetching,
  };
}

export function PlatformAnalyticsToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  periodLabel,
  activeFilters,
  onOpenFilters,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  periodLabel: string;
  activeFilters: number;
  onOpenFilters: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className={moduleSearchFilterRowClassName}>
        <div className={moduleSearchFieldWrapClassName}>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className={moduleSearchInputClassName}
            aria-label="Statistik durchsuchen"
          />
        </div>
        <div className={moduleSearchFilterButtonWrapClassName}>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className={moduleSearchFilterButtonClassName}
            aria-label="Filter"
            onClick={onOpenFilters}
          >
            <Filter className="size-4" />
          </Button>
          {activeFilters > 0 ? (
            <Badge
              variant="secondary"
              className={moduleSearchFilterActiveBadgeClassName}
            >
              {activeFilters}
            </Badge>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{periodLabel}</p>
    </div>
  );
}

export function PlatformAnalyticsMissing() {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-6 shadow-card">
      <p className="text-sm text-foreground">
        Die Statistik-Tabellen sind auf dieser Datenbank noch nicht angelegt.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Die Migration liegt unter supabase/migrations. Auf der Dev-Datenbank
        `pnpm db:push` ausführen. Die Live-Datenbank bleibt dabei unberührt.
      </p>
    </div>
  );
}

export function AnalyticsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
