"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

export type AutopilotAssetPick = {
  sourceId: string;
  label: string;
  imageUrl: string;
  platformLabel?: string;
};

type Group = "menu" | "gallery";

/**
 * Lädt Speisekarte/Galerie erst beim Öffnen — nicht beim KI-Tab-Switch.
 * Galerie: echte Thumbnails inkl. Facebook/Instagram/Google aus dem Cache.
 */
export function SocialAutopilotAssetPickerDrawer({
  open,
  onOpenChange,
  restaurantId,
  group,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  group: Group;
  selectedId: string | null;
  onSelect: (pick: AutopilotAssetPick | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<AutopilotAssetPick[]>([]);
  const [draftId, setDraftId] = useState<string | null>(selectedId);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!open) return;
    setDraftId(selectedId);
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const qs = new URLSearchParams({
          restaurantId,
          group,
        });
        const res = await fetch(`/api/social/asset-options?${qs}`);
        const data = (await res.json().catch(() => ({}))) as {
          options?: Array<{
            group?: string;
            sourceId?: string;
            label?: string;
            imageUrl?: string | null;
            platformLabel?: string;
          }>;
        };
        if (cancelled) return;
        const next = (data.options ?? [])
          .filter(
            (o) =>
              o.group === group &&
              typeof o.sourceId === "string" &&
              o.sourceId &&
              typeof o.imageUrl === "string" &&
              o.imageUrl,
          )
          .map((o) => ({
            sourceId: o.sourceId as string,
            label:
              String(o.label ?? "").trim() ||
              (group === "menu" ? "Gericht" : "Foto"),
            imageUrl: o.imageUrl as string,
            platformLabel:
              typeof o.platformLabel === "string" && o.platformLabel.trim()
                ? o.platformLabel.trim()
                : undefined,
          }));
        setOptions(next);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId, group, selectedId]);

  const title = group === "menu" ? "Speisekarte" : "Galerie";
  const description =
    group === "menu"
      ? "Ein Gericht mit Foto wählen — oder leer lassen."
      : "Foto wählen (Gwada, Facebook, Instagram, Google) — oder leer lassen.";

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("form")}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>

        <div className={cn(drawerScrollAreaClassName(6), "space-y-2 pb-4")}>
          {showSkeleton ? (
            group === "gallery" ? (
              <div className="grid grid-cols-3 gap-2" aria-busy>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-2" aria-busy>
                {[0, 1, 2, 3].map((i) => (
                  <SkeletonCardFrame key={i} className="flex gap-3 p-3">
                    <Skeleton className="size-14 shrink-0 rounded-lg" />
                    <Skeleton className="h-4 w-2/3 self-center" />
                  </SkeletonCardFrame>
                ))}
              </div>
            )
          ) : options.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
              {group === "menu"
                ? "Keine Gerichte mit Foto — Galerie oder nur Stil nutzen."
                : "Keine Fotos in Galerie oder verbundenen Kanälen — Speisekarte oder nur Stil nutzen."}
            </p>
          ) : group === "gallery" ? (
            <ul className="grid grid-cols-3 gap-2">
              {options.map((opt) => {
                const on = draftId === opt.sourceId;
                return (
                  <li key={opt.sourceId}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={opt.label}
                      onClick={() =>
                        setDraftId((prev) =>
                          prev === opt.sourceId ? null : opt.sourceId,
                        )
                      }
                      className={cn(
                        "relative aspect-square w-full overflow-hidden rounded-xl border touch-manipulation transition-colors",
                        on
                          ? "border-accent/60 ring-2 ring-accent/40"
                          : "border-border/50 hover:border-border",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={opt.imageUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                      {opt.platformLabel ? (
                        <span className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {opt.platformLabel}
                        </span>
                      ) : null}
                      {on ? (
                        <span className="absolute top-1 right-1 rounded-full bg-accent p-0.5 text-accent-foreground shadow-sm">
                          <Check className="size-3.5" />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="space-y-2">
              {options.map((opt) => {
                const on = draftId === opt.sourceId;
                return (
                  <li key={opt.sourceId}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setDraftId((prev) =>
                          prev === opt.sourceId ? null : opt.sourceId,
                        )
                      }
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left touch-manipulation transition-colors",
                        on
                          ? "border-accent/50 bg-accent/10"
                          : "border-border/50 hover:border-border",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={opt.imageUrl}
                        alt=""
                        className="size-14 shrink-0 rounded-lg object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {opt.label}
                      </span>
                      {on ? (
                        <Check className="size-4 shrink-0 text-foreground" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DrawerFooter className="gap-2">
          <Button
            type="button"
            className={cn("h-11 w-full", brandActionButtonRoundedClassName)}
            onClick={() => {
              const pick =
                draftId != null
                  ? (options.find((o) => o.sourceId === draftId) ?? null)
                  : null;
              onSelect(pick);
              onOpenChange(false);
            }}
          >
            Fertig
          </Button>
          {selectedId || draftId ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl"
              onClick={() => {
                setDraftId(null);
                onSelect(null);
                onOpenChange(false);
              }}
            >
              Auswahl entfernen
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
