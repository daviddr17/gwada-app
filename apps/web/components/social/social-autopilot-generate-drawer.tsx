"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Filter, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  countAutopilotIdeaActiveFilters,
  SocialAutopilotIdeasFilterDrawer,
} from "@/components/social/social-autopilot-ideas-filter-drawer";
import { SocialAutopilotOptionsDrawer } from "@/components/social/social-autopilot-options-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { SocialAutopilotIdea } from "@/lib/social/social-autopilot-ideas";
import {
  filterSocialAutopilotIdeas,
  groupSocialAutopilotIdeas,
  SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS,
  type SocialAutopilotIdeaFilter,
} from "@/lib/social/social-autopilot-idea-sort";
import type { SocialTone } from "@/lib/social/social-brand-kit";
import type { SocialMediaFormatId } from "@/lib/social/social-media-formats";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

type Phase = "ideas" | "creating";

/**
 * Bottom Sheet: Ideen wählen → generieren.
 * Ergebnis landet als Entwurf auf der Hauptseite — keine Ideen-Liste dort.
 */
export function SocialAutopilotGenerateDrawer({
  open,
  onOpenChange,
  restaurantId,
  aiConfigured,
  aiLabel,
  initialTone,
  initialPlatforms,
  initialFormat,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  aiConfigured: boolean | null;
  aiLabel: string;
  initialTone: SocialTone;
  initialPlatforms: NewsPlatform[];
  initialFormat: SocialMediaFormatId;
  /** Nach erfolgreichem Generate — Entwürfe auf der Hauptseite neu laden. */
  onCreated: () => void | Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>("ideas");
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideas, setIdeas] = useState<SocialAutopilotIdea[]>([]);
  const [ideaFilter, setIdeaFilter] =
    useState<SocialAutopilotIdeaFilter>("all");
  const [ideasFilterOpen, setIdeasFilterOpen] = useState(false);
  const [maxSelect, setMaxSelect] = useState(7);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sessionTone, setSessionTone] = useState<SocialTone>(initialTone);
  const [sessionPlatforms, setSessionPlatforms] =
    useState<NewsPlatform[]>(initialPlatforms);
  const [sessionFormat, setSessionFormat] =
    useState<SocialMediaFormatId>(initialFormat);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const showIdeasSkeleton = useDeferredSkeleton(ideasLoading);

  const filteredIdeas = useMemo(
    () => filterSocialAutopilotIdeas(ideas, ideaFilter),
    [ideas, ideaFilter],
  );
  const ideaGroups = useMemo(
    () => groupSocialAutopilotIdeas(filteredIdeas),
    [filteredIdeas],
  );
  const ideaFilterActiveCount = countAutopilotIdeaActiveFilters(ideaFilter);

  const loadIdeas = useCallback(
    async (opts?: { rotate?: boolean }) => {
      if (!restaurantId || aiConfigured === false) return;
      setIdeasLoading(true);
      try {
        const qs = new URLSearchParams({ restaurantId });
        if (opts?.rotate) qs.set("rotate", "1");
        // Kein forceSkip — Entwürfe auf der Hauptseite bleiben.
        const res = await fetch(`/api/social/suggestions/ideas?${qs}`);
        const data = (await res.json().catch(() => ({}))) as {
          ideas?: SocialAutopilotIdea[];
          maxSelect?: number;
          skippedReason?: string;
        };
        if (!res.ok) {
          toast.error("Ideen konnten nicht geladen werden");
          return;
        }
        if (data.skippedReason === "ai_not_configured") {
          toast.error(
            "Autopilot braucht euren Restaurant-KI-Schlüssel unter Integrationen",
          );
          onOpenChange(false);
          return;
        }
        if (data.skippedReason === "disabled") {
          toast.error("Autopilot ist in der Social-Marke ausgeschaltet");
          onOpenChange(false);
          return;
        }
        if (data.skippedReason === "needs_media") {
          toast.error(
            "Keine Bilder — bitte Galerie, Speisekarte oder Profilfotos hinterlegen",
          );
          setIdeas([]);
          setSelectedIds([]);
          return;
        }
        const next = data.ideas ?? [];
        setIdeas(next);
        setIdeaFilter("all");
        setMaxSelect(
          typeof data.maxSelect === "number" && data.maxSelect >= 0
            ? data.maxSelect
            : 7,
        );
        setSelectedIds([]);
        if (next.length === 0) {
          toast.message(
            "Keine neuen Ideen — bestehende Entwürfe nutzen oder Medien prüfen",
          );
        }
      } finally {
        setIdeasLoading(false);
      }
    },
    [restaurantId, aiConfigured, onOpenChange],
  );

  useEffect(() => {
    if (!open) {
      setPhase("ideas");
      setOptionsOpen(false);
      setSelectedIds([]);
      return;
    }
    setSessionTone(initialTone);
    setSessionPlatforms(
      initialPlatforms.length > 0
        ? [...initialPlatforms]
        : ["instagram", "facebook"],
    );
    setSessionFormat(initialFormat);
    setPhase("ideas");
    void loadIdeas({ rotate: true });
  }, [open, initialTone, initialPlatforms, initialFormat, loadIdeas]);

  const toggleIdea = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (maxSelect <= 0) {
        toast.message(
          "Wochenziel voll — erst Entwürfe auf der Hauptseite handeln",
        );
        return prev;
      }
      if (prev.length >= maxSelect) {
        toast.message(`Maximal ${maxSelect} Ideen auf einmal`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const createFromSelection = async () => {
    if (!restaurantId || selectedIds.length === 0) return;
    if (maxSelect <= 0) {
      toast.message(
        "Wochenziel voll — erst Entwürfe speichern, posten oder planen",
      );
      return;
    }
    setOptionsOpen(false);
    setPhase("creating");
    try {
      const res = await fetch("/api/social/suggestions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          ideaIds: selectedIds,
          tone: sessionTone,
          platforms: sessionPlatforms,
          mediaFormat: sessionFormat,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        generation?: {
          created?: number;
          skippedReason?: string;
          llmApplied?: number;
        };
        error?: string;
      };
      if (!res.ok || data.error === "selection_required") {
        toast.error("Bitte mindestens eine Idee auswählen");
        setPhase("ideas");
        return;
      }
      const gen = data.generation;
      if (gen?.skippedReason === "needs_media") {
        toast.error("Für die Auswahl fehlen Bilder");
        setPhase("ideas");
        return;
      }
      if (gen?.skippedReason === "week_full") {
        toast.message(
          "Wochenziel voll — Entwürfe auf der Hauptseite freigeben",
        );
        setPhase("ideas");
        return;
      }
      const created = gen?.created ?? 0;
      if (created > 0) {
        const llmHint =
          (gen?.llmApplied ?? 0) > 0
            ? " · Texte mit eurer Restaurant-KI"
            : " · Vorlagen";
        toast.success(
          `${created} Entwurf${created === 1 ? "" : "e"} erstellt${llmHint}`,
        );
        await onCreated();
        onOpenChange(false);
        return;
      }
      toast.message("Keine Entwürfe erstellt");
      setPhase("ideas");
    } catch {
      toast.error("Generieren fehlgeschlagen");
      setPhase("ideas");
    }
  };

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (phase === "creating") return;
          onOpenChange(next);
        }}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("mediaTall")}>
          <DrawerHeader className="text-left">
            <DrawerTitle>
              {phase === "creating" ? "Wird generiert …" : "Neu generieren"}
            </DrawerTitle>
            <DrawerDescription>
              {phase === "creating"
                ? `${aiLabel} schreibt Captions — danach als Entwurf auf der Hauptseite.`
                : "Ideen sind Vorschläge. Nach dem Generieren landen Entwürfe auf der Hauptseite — speichern, posten oder planen."}
            </DrawerDescription>
          </DrawerHeader>

          {phase === "creating" ? (
            <div className={cn(drawerScrollAreaClassName(6), "space-y-4")} aria-busy>
              {[0, 1, 2].map((i) => (
                <SkeletonCardFrame key={i} className="space-y-3">
                  <Skeleton className="mx-auto aspect-square w-full max-w-xs rounded-xl" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-full" />
                </SkeletonCardFrame>
              ))}
            </div>
          ) : (
            <>
              <div className={cn(drawerScrollAreaClassName(6), "space-y-4")}>
                <div className="flex items-start gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 rounded-xl border-border/60"
                    disabled={ideasLoading}
                    onClick={() => void loadIdeas({ rotate: true })}
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5",
                        ideasLoading && "animate-spin",
                      )}
                    />
                    Ideen neu mischen
                  </Button>
                  <div className="relative shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="rounded-full border-border/60"
                      aria-label="Filter & Sortierung"
                      disabled={ideas.length === 0}
                      onClick={() => setIdeasFilterOpen(true)}
                    >
                      <Filter className="size-4" />
                    </Button>
                    {ideaFilterActiveCount > 0 ? (
                      <Badge
                        variant="secondary"
                        className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums"
                      >
                        {ideaFilterActiveCount}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {maxSelect <= 0 ? (
                  <p className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-center text-xs text-muted-foreground">
                    Wochenziel voll mit Entwürfen auf der Hauptseite — erst
                    speichern, posten oder planen.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Idee ≠ Entwurf. Tippe Karten (max. {maxSelect}), dann
                    generieren.
                    {ideaFilter !== "all"
                      ? ` Filter: ${SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS[ideaFilter]}`
                      : ""}
                  </p>
                )}

                {showIdeasSkeleton ? (
                  <div className="grid grid-cols-2 gap-3" aria-busy>
                    {[0, 1, 2, 3].map((i) => (
                      <SkeletonCardFrame key={i} className="space-y-2 p-2">
                        <Skeleton className="aspect-square w-full rounded-lg" />
                        <Skeleton className="h-3 w-3/4" />
                      </SkeletonCardFrame>
                    ))}
                  </div>
                ) : ideas.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
                    Keine Ideen verfügbar. Entwürfe bleiben auf der Hauptseite.
                  </p>
                ) : filteredIdeas.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
                    Keine Ideen in diesem Filter.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {ideaGroups.map((group) => (
                      <div key={group.slotKind} className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          {group.label}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {group.ideas.map((idea) => {
                            const selected = selectedIds.includes(idea.id);
                            return (
                              <button
                                key={idea.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => toggleIdea(idea.id)}
                                className={cn(
                                  "overflow-hidden rounded-xl border text-left touch-manipulation transition-colors",
                                  selected
                                    ? "border-accent/50 bg-accent/10 ring-2 ring-accent/30"
                                    : "border-border/50 hover:border-border",
                                )}
                              >
                                <div className="relative aspect-square bg-muted/40">
                                  {idea.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={idea.imageUrl}
                                      alt=""
                                      className="size-full object-cover"
                                    />
                                  ) : null}
                                  {selected ? (
                                    <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                                      <Check className="size-3.5" />
                                    </span>
                                  ) : null}
                                </div>
                                <div className="space-y-0.5 px-2.5 py-2">
                                  <p className="line-clamp-1 text-xs font-medium">
                                    {idea.title}
                                  </p>
                                  <p className="line-clamp-1 text-[11px] text-muted-foreground">
                                    {idea.reasonLabel}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-border/50 px-6 py-3">
                <Button
                  type="button"
                  size="lg"
                  className={cn("w-full", brandActionButtonRoundedClassName)}
                  disabled={
                    selectedIds.length === 0 ||
                    ideasLoading ||
                    maxSelect <= 0
                  }
                  onClick={() => setOptionsOpen(true)}
                >
                  <Sparkles className="size-4" />
                  {selectedIds.length === 0
                    ? "Ideen auswählen"
                    : `Weiter · ${selectedIds.length} Idee${selectedIds.length === 1 ? "" : "n"}`}
                </Button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <SocialAutopilotIdeasFilterDrawer
        open={ideasFilterOpen}
        onOpenChange={setIdeasFilterOpen}
        ideas={ideas}
        filter={ideaFilter}
        onFilterChange={setIdeaFilter}
      />

      <SocialAutopilotOptionsDrawer
        open={optionsOpen && open && phase === "ideas"}
        onOpenChange={setOptionsOpen}
        title="Kanäle & Stil · generieren"
        tone={sessionTone}
        onToneChange={setSessionTone}
        platforms={sessionPlatforms}
        onPlatformsChange={setSessionPlatforms}
        format={sessionFormat}
        onFormatChange={setSessionFormat}
        doneLabel="Generieren"
        onDone={() => void createFromSelection()}
        defaults={{
          tone: initialTone,
          platforms:
            initialPlatforms.length > 0
              ? [...initialPlatforms]
              : ["instagram", "facebook"],
          format: initialFormat,
        }}
      />
    </>
  );
}
