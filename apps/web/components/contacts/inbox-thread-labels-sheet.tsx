"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Tags } from "lucide-react";
import { toast } from "sonner";
import { ContactTagChip } from "@/components/contacts/contact-tag-chip";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import type { InboxLabelRow } from "@/lib/supabase/inbox-labels-db";
import { cn } from "@/lib/utils";

export function InboxThreadLabelsSheet({
  open,
  onOpenChange,
  restaurantId,
  threadKey,
  labels,
  assignedIds,
  onLabelsChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  threadKey: string;
  labels: InboxLabelRow[];
  assignedIds: string[];
  onLabelsChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [newName, setNewName] = useState("");
  const assigned = new Set(assignedIds);

  useEffect(() => {
    if (!open) setNewName("");
  }, [open]);

  const toggle = useCallback(
    async (labelId: string, next: boolean) => {
      setPending(true);
      try {
        const res = await fetch("/api/contact-messages/inbox/labels/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            threadKey,
            labelId,
            assigned: next,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          toast.error(data.error ?? "Label konnte nicht gesetzt werden.");
          return;
        }
        onLabelsChanged();
      } finally {
        setPending(false);
      }
    },
    [onLabelsChanged, restaurantId, threadKey],
  );

  const createLabel = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setPending(true);
    try {
      const res = await fetch("/api/contact-messages/inbox/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, name }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        label?: InboxLabelRow;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.label) {
        toast.error(data.error ?? "Label konnte nicht angelegt werden.");
        return;
      }
      setNewName("");
      await toggle(data.label.id, true);
      onLabelsChanged();
    } finally {
      setPending(false);
    }
  }, [newName, onLabelsChanged, restaurantId, toggle]);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Tags className="size-4" aria-hidden />
            Labels
          </DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {labels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Labels — unten eines anlegen.
              </p>
            ) : (
              labels.map((label) => {
                const selected = assigned.has(label.id);
                return (
                  <ContactTagChip
                    key={label.id}
                    tag={label}
                    selected={selected}
                    onClick={() => void toggle(label.id, !selected)}
                    className={cn(pending && "pointer-events-none opacity-60")}
                  />
                );
              })
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Neues Label …"
              maxLength={64}
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void createLabel();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={pending || !newName.trim()}
              aria-label="Label anlegen"
              onClick={() => void createLabel()}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <DrawerFooter>
          <Button
            type="button"
            className={brandActionButtonRoundedClassName}
            onClick={() => onOpenChange(false)}
          >
            Fertig
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
