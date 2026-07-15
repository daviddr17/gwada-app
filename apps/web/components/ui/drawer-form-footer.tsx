"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  drawerHorizontalPaddingClassName,
  type DrawerContentPadding,
} from "@/lib/ui/drawer-form-section";
import { appMobileBottomSafePbLgClassName } from "@/lib/ui/app-mobile-bottom-nav";
import { cn } from "@/lib/utils";

/** Sticky Fußzeile für Bottom-Sheet-Formulare (Abbrechen · Speichern · optional Löschen). */
export function drawerFormFooterShellClassName(
  contentPadding: DrawerContentPadding = 6,
): string {
  return cn(
    "relative z-10 flex shrink-0 flex-col gap-3 border-t border-border/50 bg-card pt-4",
    drawerHorizontalPaddingClassName(contentPadding),
    appMobileBottomSafePbLgClassName,
  );
}

export const drawerFormFooterActionsRowClassName = "flex gap-3";

export const drawerFormFooterCancelButtonClassName =
  "h-12 flex-1 rounded-xl tap-scale";

export const drawerFormFooterSaveButtonClassName = cn(
  "h-12 flex-1",
  brandActionButtonRoundedClassName,
);

export const drawerFormFooterDeleteButtonClassName =
  "h-12 w-full rounded-xl";

export type DrawerFormFooterProps = {
  onCancel: () => void;
  cancelLabel?: string;
  cancelDisabled?: boolean;
  submitLabel?: string;
  submitPending?: boolean;
  submitDisabled?: boolean;
  /** `submit` innerhalb eines `<form>`, sonst `button` + `onSubmit`. */
  submitType?: "submit" | "button";
  onSubmit?: () => void;
  showDelete?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteDisabled?: boolean;
  /** Trennlinie direkt über der Fußzeile (wenn kein border-t gewünscht). */
  showSeparator?: boolean;
  /** Abbrechen-Button ausblenden (nur Speichern, volle Breite). */
  showCancel?: boolean;
  /** Speichern-Button ausblenden (nur Schließen). */
  showSubmit?: boolean;
  /** Gleiches horizontales Padding wie Scroll-Bereich (4 / 5 / 6). */
  contentPadding?: DrawerContentPadding;
  className?: string;
  children?: ReactNode;
};

export function DrawerFormFooter({
  onCancel,
  cancelLabel = "Abbrechen",
  cancelDisabled = false,
  submitLabel = "Speichern",
  submitPending = false,
  submitDisabled = false,
  submitType = "submit",
  onSubmit,
  showDelete = false,
  onDelete,
  deleteLabel = "Löschen",
  deleteDisabled = false,
  showSeparator = false,
  showCancel = true,
  showSubmit = true,
  contentPadding = 6,
  className,
  children,
}: DrawerFormFooterProps) {
  const saveLabel = submitPending ? `${submitLabel} …` : submitLabel;
  const cancelProps = {
    type: "button" as const,
    variant: "outline" as const,
    className: cn(
      drawerFormFooterCancelButtonClassName,
      !showSubmit && "flex-1",
    ),
    onClick: onCancel,
    disabled: cancelDisabled || submitPending,
  };
  const saveProps = {
    type: submitType,
    className: drawerFormFooterSaveButtonClassName,
    disabled: submitDisabled || submitPending,
    ...(submitType === "button" ? { onClick: onSubmit } : {}),
  };

  return (
    <div
      data-vaul-no-drag
      className={cn(drawerFormFooterShellClassName(contentPadding), className)}
    >
      {showSeparator ? <Separator className="-mt-4 mb-1" /> : null}
      <div className={drawerFormFooterActionsRowClassName}>
        {showCancel ? (
          <Button {...cancelProps}>{cancelLabel}</Button>
        ) : null}
        {showSubmit ? (
          <Button
            {...saveProps}
            className={cn(
              drawerFormFooterSaveButtonClassName,
              !showCancel && "flex-1",
            )}
          >
            {saveLabel}
          </Button>
        ) : null}
      </div>
      {showDelete && onDelete ? (
        <Button
          type="button"
          variant="destructive"
          className={drawerFormFooterDeleteButtonClassName}
          disabled={deleteDisabled || submitPending}
          onClick={onDelete}
        >
          {deleteLabel}
        </Button>
      ) : null}
      {children}
    </div>
  );
}
