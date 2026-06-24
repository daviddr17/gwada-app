"use client";

import { useCallback, useEffect, useState } from "react";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { toast } from "sonner";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  gwadaItems: UnifiedGalleryItem[];
  onSaved: () => void;
};

export function GalleryHighlightComposeDrawer({
  open,
  onOpenChange,
  restaurantId,
  gwadaItems,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setTitle("");
    setSelectedIds([]);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const toggleItem = useCallback((itemId: string) => {
    setSelectedIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Bitte einen Titel eingeben");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Mindestens ein Gwada-Bild auswählen");
      return;
    }

    const first = gwadaItems.find((i) => i.itemId && selectedIds.includes(i.itemId));
    setSaving(true);
    try {
      const res = await fetch("/api/gallery/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          title: trimmedTitle,
          itemIds: selectedIds,
          coverStoragePath: first?.storagePath ?? null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Highlight konnte nicht gespeichert werden");
        return;
      }
      toast.success("Highlight angelegt");
      reset();
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }, [
    title,
    selectedIds,
    gwadaItems,
    restaurantId,
    reset,
    onOpenChange,
    onSaved,
  ]);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("media")}>
        <DrawerHeader className="text-left">
          <DrawerTitle>Highlight anlegen</DrawerTitle>
        </DrawerHeader>
        <DrawerFormBody>
        <div className={drawerScrollAreaClassName(4)}>
          <DrawerFormSection contentPadding={4} title="Allgemein">
          <div className="space-y-2">
            <Label htmlFor="highlight-title">Titel</Label>
            <Input
              id="highlight-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Speisen, Team, Events"
              maxLength={120}
            />
          </div>
          </DrawerFormSection>

          <DrawerFormSection contentPadding={4} title="Bilder (Gwada)">
            {gwadaItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Zuerst eigene Bilder unter „Bild hinzufügen“ hochladen — Highlights
                funktionieren nur mit Gwada-Medien.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {gwadaItems.map((item) => {
                  const id = item.itemId!;
                  const selected = selectedIds.includes(id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-vaul-no-drag
                      onClick={() => toggleItem(id)}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-xl border-2 transition",
                        selected
                          ? "border-accent ring-2 ring-accent/30"
                          : "border-transparent opacity-90 hover:opacity-100",
                      )}
                    >
                      {item.mediaKind === "video" ? (
                        <video
                          src={item.previewUrl}
                          className="size-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.previewUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      )}
                      {selected ? (
                        <span className="absolute inset-x-0 bottom-0 bg-accent/80 py-0.5 text-center text-[10px] font-semibold text-accent-foreground">
                          {selectedIds.indexOf(id) + 1}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </DrawerFormSection>
        </div>
        <DrawerFormFooter
          onCancel={() => onOpenChange(false)}
          onSubmit={() => void handleSave()}
          submitLabel="Highlight speichern"
          submitDisabled={
            saving || !title.trim() || selectedIds.length === 0 || gwadaItems.length === 0
          }
        />
        </DrawerFormBody>
      </DrawerContent>
    </Drawer>
  );
}
