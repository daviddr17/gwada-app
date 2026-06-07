"use client";

import { Badge } from "@/components/ui/badge";
import { isTestEnvironment } from "@/lib/constants/app-environment";
import { cn } from "@/lib/utils";

export const testEnvironmentChipClassName =
  "shrink-0 border-amber-500/45 bg-amber-500/12 text-[0.625rem] font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-100 sm:text-[0.6875rem]";

export function TestEnvironmentChip({ className }: { className?: string }) {
  if (!isTestEnvironment()) return null;

  return (
    <Badge
      variant="outline"
      className={cn(testEnvironmentChipClassName, className)}
      title="Lokale Entwicklung — Daten und Code sind nicht die Live-Umgebung"
    >
      Testumgebung
    </Badge>
  );
}
