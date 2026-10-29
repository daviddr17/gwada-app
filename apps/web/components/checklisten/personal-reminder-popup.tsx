"use client";

import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import type { PersonalReminderPopupNote } from "@/lib/personal-notes/personal-reminder-due";
import { cn } from "@/lib/utils";

function remindLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PersonalReminderPopup({
  open,
  note,
  busy,
  onAcknowledge,
  onComplete,
  onOpenChange,
}: {
  open: boolean;
  note: PersonalReminderPopupNote | null;
  busy: boolean;
  onAcknowledge: () => void;
  onComplete: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-accent/15 text-accent">
            <StickyNote className="size-5" aria-hidden />
          </div>
          <DialogTitle>{note?.title ?? "Erinnerung"}</DialogTitle>
          {note?.remind_at ? (
            <DialogDescription>
              Fällig {remindLabel(note.remind_at)}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {note?.body?.trim() ? (
          <p className="whitespace-pre-wrap text-sm text-foreground/90">
            {note.body.trim()}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Persönliche Erinnerung
          </p>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={busy || !note}
            onClick={onAcknowledge}
          >
            OK
          </Button>
          <Button
            type="button"
            className={cn(brandActionButtonRoundedClassName)}
            disabled={busy || !note}
            onClick={onComplete}
          >
            Erledigt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
