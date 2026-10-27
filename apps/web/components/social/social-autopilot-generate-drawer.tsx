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
import type {
  SocialAutopilotIdea,
  SocialAutopilotIdeaHint,
} from "@/lib/social/social-autopilot-ideas";
import {
  filterSocialAutopilotIdeas,
  groupSocialAutopilotIdeas,
  SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS,
  type SocialAutopilotIdeaFilter,
} from "@/lib/social/social-autopilot-idea-sort";
import type { SocialTone } from "@/lib/social/social-brand-kit";
import {
  SOCIAL_MEDIA_FORMATS,
  type SocialMediaFormatId,
} from "@/lib/social/social-media-formats";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import {
  autopilotPrimaryButtonClassName,
  autopilotSecondaryButtonClassName,
} from "@/lib/ui/social-autopilot-buttons";
import { cn } from "@/lib/utils";

type Phase = "ideas" | "creating";

function ideaHintFromIdea(idea: SocialAutopilotIdea): SocialAutopilotIdeaHint {
  return {
    ...(idea.theme ? { theme: idea.theme } : {}),
    ...(idea.captionDirection
      ? { captionDirection: idea.captionDirection }
      : {}),
    ...(idea.suggestedFormat
      ? { suggestedFormat: idea.suggestedFormat }
      : {}),
  };
}

/**
 * Bottom Sheet: KI-Ideen wählen → generieren.
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
  const [ideasAiEnriched, setIdeasAiEnriched] = useState(false);
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
  const [formatTouched, setFormatTouched] = useState(false);
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
  const ideasById = useMemo(() => {
    const map = new Map<string, SocialAutopilotIdea>();
    for (const idea of ideas) map.set(idea.id, idea);
    return map;
  }, [ideas]);

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
          ideasAiEnriched?: boolean;
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
          setIdeasAiEnriched(false);
          return;
        }
        const next = data.ideas ?? [];
        setIdeas(next);
        setIdeasAiEnriched(Boolean(data.ideasAiEnriched));
        setIdeaFilter("all");
        setMaxSelect(
          typeof data.maxSelect === "number" && data.maxSelect >= 0
            ? data.maxSelect
            : 7,
        );
        setSelectedIds([]);
        setFormatTouched(false);
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
    setFormatTouched(false);
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
      const next = [...prev, id];
      if (!formatTouched) {
        const idea = ideasById.get(id);
        if (idea?.suggestedFormat) {
          setSessionFormat(idea.suggestedFormat);
        }
      }
      return next;
    });
  };

  const openOptionsForGenerate = () => {
    if (!formatTouched && selectedIds.length > 0) {
      const first = ideasById.get(selectedIds[0]!);
      if (first?.suggestedFormat) {
        setSessionFormat(first.suggestedFormat);
      }
    }
    setOptionsOpen(true);
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
    const ideaHints: Record<string, SocialAutopilotIdeaHint> = {};
    for (const id of selectedIds) {
      const idea = ideasById.get(id);
      if (!idea) continue;
      ideaHints[id] = ideaHintFromIdea(idea);
    }
    try {
      const res = await fetch("/api/social/suggestions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          ideaIds: selectedIds,
          ideaHints,
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
            ? " · Design & Text mit eurer Restaurant-KI"
            : " · Vorlagen";
        toast.success(
          `${created} Entwurf${created === 1 ? "" : "e"} erstellt${llmHint}`,
        );
        // Sheet sofort zu — Drafts im Hintergrund nachladen (kein Warten).
        onOpenChange(false);
        void onCreated();
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
                ? `${aiLabel} schreibt Design & Text — danach Entwurf auf der Hauptseite.`
                : "Quellen wählen (Speisekarte, Galerie, KI-Stil — alles optional) → generieren → speichern/posten/planen."}
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
                    className={cn("flex-1", autopilotSecondaryButtonClassName)}
                    disabled={ideasLoading}
                    onClick={() => void loadIdeas({ rotate: true })}
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5",
                        ideasLoading && "animate-spin",
                      )}
                    />
                    Neu mischen
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
                    Tippe Ideen (max. {maxSelect}), dann generieren.
                    {ideaFilter !== "all"
                      ? ` Quelle: ${SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS[ideaFilter]}`
                      : ideasAiEnriched
                        ? " · inkl. KI-Stil"
                        : ""}
                  </p>
                )}

                {showIdeasSkeleton ? (
                  <div className="space-y-3" aria-busy>
                    {[0, 1, 2, 3].map((i) => (
                      <SkeletonCardFrame
                        key={i}
                        className="flex gap-3 p-3"
                      >
                        <Skeleton className="size-16 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-3 w-1/3" />
                          <Skeleton className="h-4 w-4/5" />
                          <Skeleton className="h-8 w-full" />
                        </div>
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
                      <div key={group.sourceBucket} className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          {group.label}
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            optional
                          </span>
                        </p>
                        <div className="space-y-2">
                          {group.ideas.map((idea) => {
                            const selected = selectedIds.includes(idea.id);
                            const theme =
                              idea.theme?.trim() || idea.title.trim();
                            const direction =
                              idea.captionDirection?.trim() ||
                              idea.reasonDetail;
                            const formatId = idea.suggestedFormat;
                            const formatMeta = formatId
                              ? SOCIAL_MEDIA_FORMATS[formatId]
                              : null;
                            return (
                              <button
                                key={idea.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => toggleIdea(idea.id)}
                                className={cn(
                                  "flex w-full gap-3 rounded-xl border p-3 text-left touch-manipulation transition-colors",
                                  selected
                                    ? "border-accent/50 bg-accent/10 ring-2 ring-accent/30"
                                    : "border-border/50 hover:border-border",
                                )}
                              >
                                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted/40">
                                  {idea.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={idea.imageUrl}
                                      alt=""
                                      className="size-full object-cover"
                                    />
                                  ) : null}
                                  {selected ? (
                                    <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                                      <Check className="size-3" />
                                    </span>
                                  ) : null}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-medium text-muted-foreground">
                                      {idea.reasonLabel}
                                    </span>
                                    {formatMeta ? (
                                      <Badge
                                        variant="secondary"
                                        className="h-5 rounded-md px-1.5 text-[10px] font-medium"
                                      >
                                        {formatMeta.ratioLabel} ·{" "}
                                        {formatMeta.label}
                                      </Badge>
                                    ) : null}
                                    {idea.aiSuggested ? (
                                      <Badge
                                        variant="outline"
                                        className="h-5 rounded-md border-accent/40 px-1.5 text-[10px] text-accent"
                                      >
                                        KI
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                                    {theme}
                                  </p>
                                  <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                                    {direction}
                                  </p>
                                  {idea.reasonDetail &&
                                  idea.reasonDetail !== theme ? (
                                    <p className="line-clamp-1 text-[11px] text-muted-foreground/80">
                                      Bezug: {idea.reasonDetail}
                                    </p>
                                  ) : null}
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
                  className={autopilotPrimaryButtonClassName}
                  disabled={
                    selectedIds.length === 0 ||
                    ideasLoading ||
                    maxSelect <= 0
                  }
                  onClick={openOptionsForGenerate}
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
        onFormatChange={(next) => {
          setFormatTouched(true);
          setSessionFormat(next);
        }}
        doneLabel="Mit KI generieren"
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
