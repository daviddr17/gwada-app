"use client";

import { Printer, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisplayRestaurantTimezone } from "@/components/display/display-restaurant-timezone-provider";
import { printDisplayGuide } from "@/lib/display/export-display-guide";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { DisplayGuide } from "@/lib/types/guides";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { displayModuleContentClassName } from "@/lib/ui/display-module-content";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

export function DisplayGuidesModule({
  restaurantName,
}: {
  restaurantName?: string;
}) {
  const timeZone = useDisplayRestaurantTimezone();
  const [loading, setLoading] = useState(true);
  const [guides, setGuides] = useState<DisplayGuide[]>([]);
  const showDataSkeleton = useDeferredSkeleton(loading && guides.length === 0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/display/guides", { cache: "no-store" });
      const data = (await res.json()) as { guides?: DisplayGuide[]; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Anleitungen konnten nicht geladen werden.");
        setGuides([]);
      } else {
        setGuides(data.guides ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guides;
    return guides.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.short_description.toLowerCase().includes(q) ||
        g.steps.some((s) => s.body.toLowerCase().includes(q)),
    );
  }, [guides, query]);

  useEffect(() => {
    if (selectedId && !filtered.some((g) => g.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => guides.find((g) => g.id === selectedId) ?? null,
    [guides, selectedId],
  );

  async function handlePrint() {
    if (!selected) return;
    setPrinting(true);
    try {
      await printDisplayGuide(selected, {
        restaurantName,
        timeZone,
      });
    } catch {
      toast.error("Druck fehlgeschlagen.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className={displayModuleContentClassName}>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Anleitungen suchen…"
          className="h-11 rounded-2xl border-border/50 bg-card pl-10"
        />
      </div>

      {showDataSkeleton ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          Keine aktiven Anleitungen.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((guide) => (
            <li key={guide.id}>
              <button
                type="button"
                className={cn(
                  "w-full rounded-xl border border-border/50 bg-card px-4 py-3 text-left tap-scale",
                  "hover:border-border",
                )}
                onClick={() => setSelectedId(guide.id)}
              >
                <p className="font-medium">{guide.title}</p>
                {guide.short_description.trim() ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {guide.short_description}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {guide.steps.length}{" "}
                  {guide.steps.length === 1 ? "Schritt" : "Schritte"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("form")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle>{selected?.title ?? "Anleitung"}</DrawerTitle>
            {selected?.short_description.trim() ? (
              <DrawerDescription>{selected.short_description}</DrawerDescription>
            ) : null}
          </DrawerHeader>
          <div className={cn(drawerScrollAreaClassName(6), "space-y-6")}>
            {selected?.steps.map((step, index) => (
              <section key={step.id} className="space-y-2">
                <h3 className="text-sm font-semibold">Schritt {index + 1}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {step.body.trim() || "—"}
                </p>
                {step.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={step.image_url}
                    alt=""
                    className="max-h-72 w-full rounded-xl border border-border/40 object-contain"
                  />
                ) : null}
                {step.video_url ? (
                  <video
                    src={step.video_url}
                    controls
                    className="max-h-72 w-full rounded-xl border border-border/40"
                  />
                ) : null}
              </section>
            ))}
            <Button
              type="button"
              className={cn("w-full", brandActionButtonRoundedClassName)}
              disabled={!selected || printing}
              onClick={() => void handlePrint()}
            >
              <Printer className="size-4" />
              {printing ? "Wird vorbereitet…" : "Drucken"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
