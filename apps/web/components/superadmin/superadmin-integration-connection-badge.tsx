"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";
import { cn } from "@/lib/utils";

const STATE_META = {
  ok: {
    label: "Verbindung OK",
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  },
  error: {
    label: "Verbindung fehlgeschlagen",
    className:
      "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300",
  },
  not_configured: {
    label: "Nicht konfiguriert",
    className: "text-muted-foreground",
  },
  disabled: {
    label: "Deaktiviert",
    className: "text-muted-foreground",
  },
  checking: {
    label: "Prüfe Verbindung…",
    className: "text-muted-foreground",
  },
} as const;

export function SuperadminIntegrationConnectionBadge({
  connection,
  checking = false,
}: {
  connection?: SuperadminIntegrationConnectionHealth | null;
  checking?: boolean;
}) {
  const state = checking
    ? "checking"
    : (connection?.state ?? "not_configured");
  const meta = STATE_META[state];
  const detail = connection?.message;
  const latency =
    connection?.latencyMs != null ? `${connection.latencyMs} ms` : null;

  const badge = (
    <Badge variant="outline" className={cn("text-xs", meta.className)}>
      {meta.label}
      {latency && state === "ok" ? ` · ${latency}` : null}
    </Badge>
  );

  if (!detail) return badge;

  return (
    <Tooltip>
      <TooltipTrigger render={badge} />
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}
