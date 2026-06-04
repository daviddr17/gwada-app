"use client";

import { Check, AlertTriangle, Loader2, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HoursPlatformSyncCheck } from "@/lib/integrations/opening-hours-platform-status-types";
import { cn } from "@/lib/utils";

export function OpeningHoursPlatformSyncStatusBadge({
  platformLabel,
  check,
  loading,
  connected,
  hoursDirty,
}: {
  platformLabel: string;
  check: HoursPlatformSyncCheck | null | undefined;
  loading: boolean;
  connected: boolean;
  hoursDirty?: boolean;
}) {
  if (!connected) return null;

  if (loading && !check) {
    return (
      <Badge variant="outline" className="gap-1 font-normal">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        {platformLabel}: wird geprüft…
      </Badge>
    );
  }

  if (!check) return null;

  const dirtyHint = hoursDirty
    ? " (Vergleich mit zuletzt gespeicherten Zeiten)"
    : "";

  if (check.status === "in_sync") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 border-green-500/35 bg-green-500/10 font-normal text-green-800 dark:text-green-200",
        )}
        title={`${check.message}${dirtyHint}`}
      >
        <Check className="size-3 shrink-0" aria-hidden />
        {platformLabel}: aktuell
      </Badge>
    );
  }

  if (check.status === "out_of_sync") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 border-amber-500/40 bg-amber-500/10 font-normal text-amber-950 dark:text-amber-100",
        )}
        title={`${check.message}${dirtyHint}`}
      >
        <AlertTriangle className="size-3 shrink-0" aria-hidden />
        {platformLabel}: abweichend
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 font-normal text-muted-foreground"
      title={check.message}
    >
      <Minus className="size-3 shrink-0" aria-hidden />
      {platformLabel}: Prüfung fehlgeschlagen
    </Badge>
  );
}

export function OpeningHoursPlatformSyncStatusRow({
  children,
  badges,
}: {
  children: React.ReactNode;
  badges: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {badges ? (
        <div className="flex flex-wrap items-center gap-2">{badges}</div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{children}</div>
    </div>
  );
}
