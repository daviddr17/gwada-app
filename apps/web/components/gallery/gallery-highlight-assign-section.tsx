"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type HighlightMembership = {
  id: string;
  title: string;
  member: boolean;
};

type Props = {
  restaurantId: string;
  itemId: string;
  storagePath: string | null;
  open: boolean;
  onChanged: () => void;
};

export function GalleryHighlightAssignSection({
  restaurantId,
  itemId,
  storagePath,
  open,
  onChanged,
}: Props) {
  const [highlights, setHighlights] = useState<HighlightMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | "new" | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const loadMembership = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ restaurantId, itemId });
      const res = await fetch(`/api/gallery/highlights/membership?${params}`);
      const data = (await res.json()) as {
        highlights?: HighlightMembership[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "load_failed");
      setHighlights(data.highlights ?? []);
    } catch {
      toast.error("Highlights konnten nicht geladen werden");
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, itemId]);

  useEffect(() => {
    if (!open) {
      setShowNew(false);
      setNewTitle("");
      return;
    }
    void loadMembership();
  }, [open, loadMembership]);

  const patchMembership = useCallback(
    async (nextIds: string[]) => {
      const res = await fetch("/api/gallery/highlights/membership", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, itemId, highlightIds: nextIds }),
      });
      const data = (await res.json()) as {
        highlights?: HighlightMembership[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "save_failed");
      setHighlights(data.highlights ?? []);
      onChanged();
    },
    [restaurantId, itemId, onChanged],
  );

  const toggleHighlight = useCallback(
    async (highlightId: string) => {
      const isMember = highlights.some((h) => h.id === highlightId && h.member);
      const nextIds = isMember
        ? highlights.filter((h) => h.member && h.id !== highlightId).map((h) => h.id)
        : [...highlights.filter((h) => h.member).map((h) => h.id), highlightId];

      setSavingId(highlightId);
      try {
        await patchMembership(nextIds);
      } catch {
        toast.error("Highlight-Zuordnung fehlgeschlagen");
      } finally {
        setSavingId(null);
      }
    },
    [highlights, patchMembership],
  );

  const createHighlightAndAssign = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) {
      toast.error("Bitte einen Titel eingeben");
      return;
    }

    setSavingId("new");
    try {
      const res = await fetch("/api/gallery/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          title,
          itemIds: [itemId],
          coverStoragePath: storagePath,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "create_failed");

      setNewTitle("");
      setShowNew(false);
      await loadMembership();
      onChanged();
      toast.success("Highlight-Ring angelegt");
    } catch {
      toast.error("Highlight konnte nicht angelegt werden");
    } finally {
      setSavingId(null);
    }
  }, [newTitle, restaurantId, itemId, storagePath, loadMembership, onChanged]);

  return (
    <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
      <p className="text-sm font-medium">Highlight-Ringe</p>
      {loading ? (
        <div className="space-y-2" aria-busy>
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ) : highlights.length === 0 && !showNew ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Highlight-Ringe — lege einen an, um dieses Bild zuzuordnen.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {highlights.map((highlight) => {
            const busy = savingId === highlight.id;
            return (
              <Button
                key={highlight.id}
                type="button"
                variant={highlight.member ? "secondary" : "outline"}
                size="sm"
                className={cn(
                  "rounded-full",
                  highlight.member && "border-accent/40 bg-accent/10",
                )}
                disabled={busy || savingId === "new"}
                onClick={() => void toggleHighlight(highlight.id)}
              >
                {highlight.member ? (
                  <Check className="size-3.5 shrink-0" aria-hidden />
                ) : null}
                {highlight.title}
              </Button>
            );
          })}
        </div>
      )}

      {showNew ? (
        <div className="space-y-2 pt-1">
          <Label htmlFor="gallery-new-highlight-title" className="sr-only">
            Titel für neuen Highlight-Ring
          </Label>
          <Input
            id="gallery-new-highlight-title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="z. B. Speisen, Team, Events"
            maxLength={120}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1 rounded-xl"
              disabled={savingId === "new" || !newTitle.trim()}
              onClick={() => void createHighlightAndAssign()}
            >
              Anlegen & zuordnen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={savingId === "new"}
              onClick={() => {
                setShowNew(false);
                setNewTitle("");
              }}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start rounded-xl"
          disabled={savingId !== null}
          onClick={() => setShowNew(true)}
        >
          <Plus className="size-4" />
          Neuer Highlight-Ring
        </Button>
      )}
    </div>
  );
}
