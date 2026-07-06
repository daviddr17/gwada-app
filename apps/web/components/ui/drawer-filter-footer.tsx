"use client";

import { Button } from "@/components/ui/button";
import {
  drawerFormFooterActionsRowClassName,
  drawerFormFooterCancelButtonClassName,
  drawerFormFooterSaveButtonClassName,
  drawerFormFooterShellClassName,
} from "@/components/ui/drawer-form-footer";
import type { DrawerContentPadding } from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

export type DrawerFilterFooterProps = {
  onReset: () => void;
  onDone: () => void;
  resetLabel?: string;
  doneLabel?: string;
  resetDisabled?: boolean;
  contentPadding?: DrawerContentPadding;
  className?: string;
};

/** Sticky Footer für Filter-Bottom-Sheets (Zurücksetzen · Fertig). */
export function DrawerFilterFooter({
  onReset,
  onDone,
  resetLabel = "Zurücksetzen",
  doneLabel = "Fertig",
  resetDisabled = false,
  contentPadding = 6,
  className,
}: DrawerFilterFooterProps) {
  return (
    <div
      data-vaul-no-drag
      className={cn(drawerFormFooterShellClassName(contentPadding), className)}
    >
      <div className={drawerFormFooterActionsRowClassName}>
        <Button
          type="button"
          variant="outline"
          className={drawerFormFooterCancelButtonClassName}
          disabled={resetDisabled}
          onClick={onReset}
        >
          {resetLabel}
        </Button>
        <Button
          type="button"
          className={drawerFormFooterSaveButtonClassName}
          onClick={onDone}
        >
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}
