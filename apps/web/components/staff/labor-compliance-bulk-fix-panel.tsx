"use client";

import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

const FIX_MODES = [
  {
    value: "normal" as const,
    title: "Pause verbuchen",
    hint: "Netto-Arbeitszeit wird kürzer",
  },
  {
    value: "extend_end" as const,
    title: "Pause + Ende verlängern",
    hint: "Nur Dokumentation, Netto bleibt",
  },
];

export function LaborComplianceBulkFixPanel({
  fixableCount,
  fixMode,
  onFixModeChange,
  onFixClick,
  disabled,
  className,
  compact,
}: {
  fixableCount: number;
  fixMode: "normal" | "extend_end";
  onFixModeChange: (mode: "normal" | "extend_end") => void;
  onFixClick: () => void;
  disabled?: boolean;
  className?: string;
  /** Kompakter Footer: Modus-Toggles + Button, ohne große Karte. */
  compact?: boolean;
}) {
  if (fixableCount <= 0) return null;

  const modePicker = (
    <div
      className="grid min-w-0 gap-2"
      role="radiogroup"
      aria-label="Korrektur-Modus"
    >
      {FIX_MODES.map((mode) => {
        const selected = fixMode === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onFixModeChange(mode.value)}
            className={cn(
              "min-w-0 rounded-xl border px-3 py-2.5 text-left transition-colors",
              selected
                ? "border-accent/50 bg-accent/10 ring-1 ring-accent/30"
                : "border-border/50 bg-background hover:bg-muted/40",
              disabled && "opacity-50",
            )}
          >
            <span className="block text-sm font-medium">{mode.title}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {mode.hint}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (compact) {
    return (
      <div className={cn("min-w-0 space-y-3", className)}>
        {modePicker}
        <Button
          type="button"
          className={cn(brandActionButtonRoundedClassName, "w-full")}
          disabled={disabled}
          onClick={onFixClick}
        >
          {fixableCount} Pause{fixableCount === 1 ? "" : "n"} beheben
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-w-0 space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4",
        className,
      )}
    >
      <p className="text-sm font-medium">
        Pausen beheben ({fixableCount} behebbar)
      </p>
      {modePicker}
      <Button
        type="button"
        className={cn(brandActionButtonRoundedClassName, "w-full")}
        disabled={disabled}
        onClick={onFixClick}
      >
        {fixableCount} Verstoß{fixableCount === 1 ? "" : "e"} beheben
      </Button>
    </div>
  );
}
