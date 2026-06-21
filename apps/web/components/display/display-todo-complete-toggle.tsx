"use client";

import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** Display: ToDo per Switch erledigen — optional wieder öffnen (pro ToDo konfiguriert). */
export function DisplayTodoCompleteToggle({
  checked = false,
  allowReopen = false,
  busy = false,
  disabled = false,
  onMarkComplete,
  onMarkIncomplete,
  className,
  label = "Erledigt",
}: {
  checked?: boolean;
  allowReopen?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onMarkComplete: () => void;
  onMarkIncomplete?: () => void;
  className?: string;
  label?: string;
}) {
  const lockedAfterComplete = checked && !allowReopen;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-card/80 px-4 py-3.5",
        checked && "border-emerald-500/35 bg-emerald-500/5",
        className,
      )}
    >
      <span
        className={cn(
          "text-sm font-medium text-foreground",
          checked && "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {label}
      </span>
      <div className="flex shrink-0 items-center gap-2.5">
        {busy ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
        <Switch
          checked={checked}
          disabled={disabled || busy || lockedAfterComplete}
          className="h-8 w-14 [--switch-padding:3px] [--switch-thumb-size:26px] data-checked:bg-emerald-600 dark:data-checked:bg-emerald-500"
          aria-label={label}
          onCheckedChange={(value) => {
            if (value) onMarkComplete();
            else if (allowReopen && onMarkIncomplete) onMarkIncomplete();
          }}
        />
      </div>
    </div>
  );
}
