"use client";

import { LayoutList, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InventoryModuleViewMode } from "@/lib/hooks/use-inventory-module-view-mode";

export function InventoryModuleViewToggle({
  value,
  onChange,
  disabled,
}: {
  value: InventoryModuleViewMode;
  onChange: (next: InventoryModuleViewMode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-full border border-border/50 bg-muted/35 p-1"
      role="group"
      aria-label="Ansicht"
    >
      <Button
        type="button"
        variant={value === "standard" ? "secondary" : "ghost"}
        size="icon-sm"
        className="rounded-full"
        aria-pressed={value === "standard"}
        aria-label="Standardansicht"
        disabled={disabled}
        onClick={() => onChange("standard")}
      >
        <LayoutList className="size-4" />
      </Button>
      <Button
        type="button"
        variant={value === "compact" ? "secondary" : "ghost"}
        size="icon-sm"
        className="rounded-full"
        aria-pressed={value === "compact"}
        aria-label="Kompaktansicht"
        disabled={disabled}
        onClick={() => onChange("compact")}
      >
        <Rows3 className="size-4" />
      </Button>
    </div>
  );
}
