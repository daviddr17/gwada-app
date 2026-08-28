"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

export function LaborComplianceBulkFixPanel({
  fixableCount,
  fixMode,
  onFixModeChange,
  onFixClick,
  disabled,
  className,
}: {
  fixableCount: number;
  fixMode: "normal" | "extend_end";
  onFixModeChange: (mode: "normal" | "extend_end") => void;
  onFixClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  if (fixableCount <= 0) return null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4",
        className,
      )}
    >
      <p className="text-sm font-medium">
        Pausen beheben ({fixableCount} behebbar)
      </p>
      <div className="space-y-1.5">
        <Label>Korrektur-Modus</Label>
        <Select
          value={fixMode}
          onValueChange={(v) => {
            if (v === "normal" || v === "extend_end") onFixModeChange(v);
          }}
        >
          <SelectTrigger
            className={appSelectTriggerAccentCn("h-10 w-full rounded-xl")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">
              Pause verbuchen (Netto-Arbeitszeit kürzer)
            </SelectItem>
            <SelectItem value="extend_end">
              Pause verbuchen + Ende verlängern (Dokumentation)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        className={brandActionButtonRoundedClassName}
        disabled={disabled}
        onClick={onFixClick}
      >
        {fixableCount} Verstoß{fixableCount === 1 ? "" : "e"} beheben
      </Button>
    </div>
  );
}
