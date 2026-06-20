"use client";

import { useCallback, useEffect, useState } from "react";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  gwadaItems: UnifiedNewsItem[];
  onSaved: () => void;
};

export function NewsStoryRingComposeDrawer({
  open,
  onOpenChange,
  restaurantId,
  gwadaItems,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const selectableItems = gwadaItems.filter(
    (item) => item.platform === "gwada" && item.postId && item.media.length > 0,
  );

  const reset = useCallback(() => {
    setTitle("");
    setSelectedIds([]);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const toggleItem = useCallback((postId: string) => {
    setSelectedIds((prev) =>
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId],
    );
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Bitte einen Titel eingeben");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Mindestens einen Beitrag auswählen");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/news/story-rings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          title: trimmedTitle,
          postIds: selectedIds,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Story-Ring konnte nicht gespeichert werden");
        return;
      }
      toast.success("Story-Ring angelegt");
      reset();
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }, [title, selectedIds, restaurantId, reset, onOpenChange, onSaved]);

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
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Story-Ring anlegen</DrawerTitle>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(4)}>
          <DrawerFormSection contentPadding={4} title="Allgemein">
          <div className="space-y-2">
            <Label htmlFor="story-ring-title">Titel</Label>
            <Input
              id="story-ring-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z. B. Aktionen, Team, Events"
            />
          </div>
          </DrawerFormSection>

          <DrawerFormSection contentPadding={4} title="Gwada-Beiträge">
            {selectableItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine veröffentlichten Beiträge mit Bild oder Video.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {selectableItems.map((item) => {
                  const postId = item.postId!;
                  const selected = selectedIds.includes(postId);
                  const preview = item.media[0]?.url;
                  return (
                    <button
                      key={postId}
                      type="button"
                      onClick={() => toggleItem(postId)}
                      className={cn(
                        "relative overflow-hidden rounded-lg border-2 text-left transition",
                        selected
                          ? "border-accent ring-2 ring-accent/30"
                          : "border-border/50 hover:border-border",
                      )}
                    >
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt=""
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div className="aspect-square bg-muted/30" />
                      )}
                      <span className="line-clamp-2 px-2 py-1 text-xs">
                        {item.title?.trim() || item.body.slice(0, 40)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </DrawerFormSection>
        </div>
        <DrawerFormFooter
          className="px-4 pb-6"
          onCancel={() => onOpenChange(false)}
          cancelDisabled={saving}
          submitLabel="Speichern"
          submitPending={saving}
          submitDisabled={selectableItems.length === 0}
          submitType="button"
          onSubmit={() => void handleSave()}
        />
      </DrawerContent>
    </Drawer>
  );
}
