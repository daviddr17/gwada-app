"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  PosZAutopilotImportRow,
  PosZAutopilotStatus,
  PosZAutopilotStepStatus,
} from "@/lib/types/accounting-pos-z-autopilot";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<PosZAutopilotStatus, string> = {
  pending: "Offen",
  running: "Läuft",
  ok: "OK",
  partial: "Teilweise",
  error: "Fehler",
  skipped: "Aus",
};

const STEP_DOT: Record<PosZAutopilotStepStatus, string> = {
  pending: "bg-muted-foreground/40",
  ok: "bg-emerald-500",
  error: "bg-destructive",
  skipped: "bg-muted-foreground/30",
  waiting: "bg-amber-400",
};

function statusBadgeVariant(
  status: PosZAutopilotStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ok") return "default";
  if (status === "error") return "destructive";
  if (status === "partial") return "secondary";
  return "outline";
}

export function PosZAutopilotCell({
  row,
  canRetry,
  retrying,
  onRetry,
}: {
  row: PosZAutopilotImportRow | null | undefined;
  canRetry: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  if (!row) {
    return (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }

  const showRetry =
    canRetry &&
    (row.status === "error" || row.status === "partial" || row.status === "pending");

  return (
    <div className="flex flex-col items-start gap-1.5">
      <TooltipProvider delay={200}>
        <Tooltip>
          <TooltipTrigger className="inline-flex items-center gap-1.5 rounded-md text-left">
            <Badge
              variant={statusBadgeVariant(row.status)}
              className="text-[11px] font-medium"
            >
              {STATUS_LABEL[row.status]}
            </Badge>
            <span className="inline-flex items-center gap-0.5">
              {row.steps.map((step) => (
                <span
                  key={step.key}
                  className={cn("size-1.5 rounded-full", STEP_DOT[step.status])}
                  title={`${step.label}: ${step.status}`}
                />
              ))}
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="left"
            className="max-w-xs flex-col items-start gap-1.5 bg-popover px-2.5 py-2 text-popover-foreground"
          >
            <p className="text-xs font-medium">POS-Autopilot</p>
            <ul className="space-y-1">
              {row.steps.map((step) => (
                <li key={step.key} className="text-xs leading-snug">
                  <span className="font-medium">{step.label}</span>
                  {": "}
                  <span className="opacity-80">
                    {step.error || step.detail || step.status}
                  </span>
                </li>
              ))}
            </ul>
            {row.last_error ? (
              <p className="text-xs text-destructive">{row.last_error}</p>
            ) : null}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {showRetry ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <RotateCcw className="size-3" aria-hidden />
          )}
          Erneut
        </Button>
      ) : null}
    </div>
  );
}
