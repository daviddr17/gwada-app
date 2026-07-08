"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Löschen",
  cancelLabel = "Abbrechen",
  destructive = true,
  confirmDisabled = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) setPending(false);
  }, [open]);

  const runConfirm = async () => {
    if (pending || confirmDisabled) return;
    setPending(true);
    try {
      await Promise.resolve(onConfirm());
      onOpenChange(false);
    } catch {
      /* bleibt offen */
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && pending) return;
        onOpenChange(nextOpen);
      }}
      modal
      disablePointerDismissal={pending}
    >
      {/*
        Vaul/Base-UI-Drawer (z-210) + ggf. transform erzeugen eigene Stacking-Kontexte.
        Portal-Wrapper: fullscreen fixed + sehr hoher z-index + isolate, damit
        Backdrop/Popup garantiert über dem Bottom-Sheet liegen und Klicks nicht
        „durchfallen“.
      */}
      <Dialog.Portal
        className={cn(
          "pointer-events-none fixed inset-0 isolate z-[2147483000]",
        )}
      >
        <Dialog.Backdrop
          className={cn(
            "pointer-events-auto fixed inset-0 z-0 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
          )}
        />
        <Dialog.Popup
          className={cn(
            "pointer-events-auto fixed top-1/2 left-1/2 z-[1] w-[min(100%-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-popover p-5 text-popover-foreground shadow-none ring-1 ring-black/5 duration-200 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 dark:shadow-xl dark:ring-white/10",
          )}
        >
          <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </Dialog.Title>
          {description != null && description !== "" ? (
            <Dialog.Description
              render={
                <div className="mt-2 text-sm text-muted-foreground" />
              }
            >
              {description}
            </Dialog.Description>
          ) : null}

          <div className="mt-5 flex gap-2">
            <Dialog.Close
              disabled={pending}
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 rounded-xl"
                />
              }
            >
              {cancelLabel}
            </Dialog.Close>
            <Button
              type="button"
              variant={destructive ? "destructive" : "default"}
              className="h-11 flex-1 rounded-xl"
              disabled={pending || confirmDisabled}
              onClick={() => void runConfirm()}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
