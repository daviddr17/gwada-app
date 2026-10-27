"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { APP_ROUTES } from "@/lib/navigation/app-routes";
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
import { SOCIAL_AUTOPILOT_IDEAS_FETCH_TIMEOUT_MS } from "@/lib/social/social-autopilot-bounds";
import type { SocialTone } from "@/lib/social/social-brand-kit";
import type { SocialMediaFormatId } from "@/lib/social/social-media-formats";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import {
  autopilotPrimaryButtonClassName,
  autopilotSecondaryButtonClassName,
} from "@/lib/ui/social-autopilot-buttons";
import { cn } from "@/lib/utils";

type Phase = "ideas" | "creating";

type IdeasLoadError =
  | "timeout"
  | "network"
  | "ai_not_configured"
  | "disabled"
  | "needs_media"
  | "load_failed"
  | null;

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

function ideasErrorCopy(error: Exclude<IdeasLoadError, null>): {
  title: string;
  detail: string;
  linkHref?: string;
  linkLabel?: string;
} {
  switch (error) {
    case "ai_not_configured":
      return {
        title: "KI noch nicht verbunden",
        detail:
          "Speisekarte und Galerie gehen trotzdem — zum Schreiben braucht Autopilot einmal OpenAI oder Grok.",
        linkHref: APP_ROUTES.settings.integrations,
        linkLabel: "KI verbinden",
      };
    case "disabled":
      return {
        title: "Autopilot ist aus",
        detail: "Unter Schreibstil könnt ihr ihn wieder einschalten.",
      };
    case "needs_media":
      return {
        title: "Noch keine Fotos",
        detail: "Galerie oder Speisekarte mit Bildern ergänzen — dann gibt’s Ideen.",
        linkHref: APP_ROUTES.galerie.overview,
        linkLabel: "Zur Galerie",
      };
    case "timeout":
      return {
        title: "Dauert zu lange",
        detail:
          "Die Ideen-Anfrage wurde abgebrochen. Speisekarte/Galerie könnt ihr erneut laden.",
      };
    case "network":
      return {
        title: "Keine Verbindung",
        detail: "Netz prüfen und nochmal „Andere Ideen“ tippen.",
      };
    default:
      return {
        title: "Ideen nicht geladen",
        detail: "Kurz warten und nochmal versuchen.",
      };
  }
}

/**
 * Bottom Sheet: Quellen tippen → erstellen.
 * Ergebnis = Entwurf auf der Hauptseite.
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
  /** Ohne eigenen Drawer — Inhalt im „Neue News“-Sheet. */
  embedded = false,
  /** Sofort als News-Entwürfe materialisieren (Standard für Neue-News-KI). */
  asNewsDrafts = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  aiConfigured: boolean | null;
  aiLabel: string;
  initialTone: SocialTone;
  initialPlatforms: NewsPlatform[];
  initialFormat: SocialMediaFormatId;
  /** Nach erfolgreichem Generate — Entwürfe in der News-Liste neu laden. */
  onCreated: () => void | Promise<void>;
  embedded?: boolean;
  asNewsDrafts?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("ideas");
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideas, setIdeas] = useState<SocialAutopilotIdea[]>([]);
  const [ideasError, setIdeasError] = useState<IdeasLoadError>(null);
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
  const loadAbortRef = useRef<AbortController | null>(null);
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
      if (!restaurantId) return;

      loadAbortRef.current?.abort();
      const controller = new AbortController();
      loadAbortRef.current = controller;
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, SOCIAL_AUTOPILOT_IDEAS_FETCH_TIMEOUT_MS);

      setIdeasLoading(true);
      setIdeasError(null);
      try {
        const qs = new URLSearchParams({ restaurantId });
        if (opts?.rotate) qs.set("rotate", "1");
        // Kein forceSkip — Entwürfe auf der Hauptseite bleiben.
        const res = await fetch(`/api/social/suggestions/ideas?${qs}`, {
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as {
          ideas?: SocialAutopilotIdea[];
          maxSelect?: number;
          skippedReason?: string;
          aiConfigured?: boolean;
        };
        if (controller.signal.aborted) return;

        if (!res.ok) {
          setIdeas([]);
          setSelectedIds([]);
          setIdeasError("load_failed");
          toast.error("Ideen konnten nicht geladen werden");
          return;
        }
        if (data.skippedReason === "disabled") {
          setIdeas([]);
          setSelectedIds([]);
          setIdeasError("disabled");
          return;
        }
        if (data.skippedReason === "needs_media") {
          setIdeas([]);
          setSelectedIds([]);
          setIdeasError("needs_media");
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
        setFormatTouched(false);

        if (next.length === 0) {
          if (
            data.skippedReason === "ai_not_configured" ||
            data.aiConfigured === false ||
            aiConfigured === false
          ) {
            setIdeasError("ai_not_configured");
          }
          return;
        }

        if (data.aiConfigured === false || aiConfigured === false) {
          // Katalog da, aber Schreiben braucht KI — Hinweis, kein Block.
          setIdeasError("ai_not_configured");
        }
      } catch (err) {
        if (controller.signal.aborted) {
          // Neuer Request oder Timeout — nur Timeout als Fehler zeigen,
          // wenn dieser Controller noch der aktuelle ist.
          if (loadAbortRef.current === controller) {
            setIdeas([]);
            setSelectedIds([]);
            setIdeasError("timeout");
            toast.error("Ideen-Laden abgebrochen — zu lange keine Antwort");
          }
          return;
        }
        const isAbort =
          err instanceof DOMException && err.name === "AbortError";
        setIdeas([]);
        setSelectedIds([]);
        setIdeasError(isAbort ? "timeout" : "network");
        toast.error(
          isAbort
            ? "Ideen-Laden abgebrochen — zu lange keine Antwort"
            : "Ideen konnten nicht geladen werden",
        );
      } finally {
        clearTimeout(timeoutId);
        if (loadAbortRef.current === controller) {
          setIdeasLoading(false);
        }
      }
    },
    [restaurantId, aiConfigured],
  );

  useEffect(() => {
    if (!open) {
      loadAbortRef.current?.abort();
      loadAbortRef.current = null;
      setPhase("ideas");
      setOptionsOpen(false);
      setSelectedIds([]);
      setIdeasError(null);
      setIdeasLoading(false);
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

  useEffect(() => {
    return () => {
      loadAbortRef.current?.abort();
    };
  }, []);

  const toggleIdea = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (maxSelect <= 0) {
        toast.message(
          "Wochenziel voll — erst Entwürfe in der News-Liste handeln",
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
    if (aiConfigured === false) {
      toast.error("Bitte zuerst KI unter Integrationen verbinden");
      return;
    }
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
    if (aiConfigured === false) {
      toast.error("Bitte zuerst KI unter Integrationen verbinden");
      setPhase("ideas");
      return;
    }
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
          asNewsDrafts,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        generation?: {
          created?: number;
          newsDraftsCreated?: number;
          skippedReason?: string;
          llmApplied?: number;
        };
        error?: string;
      };
      if (!res.ok || data.error === "selection_required") {
        toast.error("Bitte etwas auswählen");
        setPhase("ideas");
        return;
      }
      const gen = data.generation;
      if (gen?.skippedReason === "ai_not_configured") {
        toast.error("Bitte zuerst KI unter Integrationen verbinden");
        setIdeasError("ai_not_configured");
        setPhase("ideas");
        return;
      }
      if (gen?.skippedReason === "needs_media") {
        toast.error("Dafür fehlen noch Fotos");
        setPhase("ideas");
        return;
      }
      if (gen?.skippedReason === "week_full") {
        toast.message("Genug für diese Woche — erst Entwürfe posten");
        setPhase("ideas");
        return;
      }
      const drafts =
        typeof gen?.newsDraftsCreated === "number"
          ? gen.newsDraftsCreated
          : (gen?.created ?? 0);
      if (drafts > 0) {
        toast.success(
          drafts === 1
            ? "Entwurf in der News-Liste — dort freigeben oder bearbeiten"
            : `${drafts} Entwürfe in der News-Liste — dort freigeben oder bearbeiten`,
        );
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

  const errorCopy = ideasError ? ideasErrorCopy(ideasError) : null;
  const showIdeasList = !showIdeasSkeleton && ideas.length > 0;
  const showEmpty =
    !showIdeasSkeleton && ideas.length === 0 && !ideasError;
  const showErrorBanner = !showIdeasSkeleton && Boolean(errorCopy);

  const mainBody =
    phase === "creating" ? (
      <div
        className={cn(
          embedded ? "min-h-0 flex-1 space-y-4 overflow-y-auto px-1" : drawerScrollAreaClassName(6),
          !embedded && "space-y-4",
        )}
        aria-busy
      >
        <p className="text-sm text-muted-foreground">
          {aiLabel} schreibt Bild und Text für euch …
        </p>
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
        <div
          className={cn(
            embedded
              ? "min-h-0 flex-1 space-y-4 overflow-y-auto px-1"
              : cn(drawerScrollAreaClassName(6), "space-y-4"),
          )}
        >
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
                    Andere Ideen
                  </Button>
                  <div className="relative shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="rounded-full border-border/60"
                      aria-label="Quellen"
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
                    Genug Entwürfe für diese Woche — erst posten oder speichern.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Tippen und erstellen
                    {maxSelect < 7 ? ` (max. ${maxSelect})` : ""}.
                    {ideaFilter !== "all"
                      ? ` Nur ${SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS[ideaFilter]}.`
                      : ""}
                  </p>
                )}

                {showErrorBanner && errorCopy ? (
                  <div className="space-y-3 rounded-xl border border-dashed border-border/60 px-3 py-4">
                    <div className="space-y-1 text-center">
                      <p className="text-sm font-medium text-foreground">
                        {errorCopy.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {errorCopy.detail}
                      </p>
                    </div>
                    {errorCopy.linkHref && errorCopy.linkLabel ? (
                      <Button
                        type="button"
                        className={autopilotPrimaryButtonClassName}
                        render={<Link href={errorCopy.linkHref} />}
                      >
                        {errorCopy.linkLabel}
                      </Button>
                    ) : ideasError === "timeout" ||
                      ideasError === "network" ||
                      ideasError === "load_failed" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={autopilotSecondaryButtonClassName}
                        disabled={ideasLoading}
                        onClick={() => void loadIdeas({ rotate: true })}
                      >
                        Nochmal laden
                      </Button>
                    ) : null}
                  </div>
                ) : null}

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
                ) : null}

                {showEmpty ? (
                  <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
                    Gerade keine Ideen — später nochmal oder Fotos ergänzen.
                  </p>
                ) : null}

                {showIdeasList ? (
                  filteredIdeas.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
                      Nichts in dieser Quelle — Filter zurücksetzen.
                    </p>
                  ) : (
                    <div className="space-y-5">
                      {ideaGroups.map((group) => (
                        <div key={group.sourceBucket} className="space-y-2">
                          <p className="text-sm font-medium text-foreground">
                            {group.label}
                          </p>
                          <div className="space-y-2">
                            {group.ideas.map((idea) => {
                              const selected = selectedIds.includes(idea.id);
                              const theme =
                                idea.theme?.trim() || idea.title.trim();
                              const direction =
                                idea.captionDirection?.trim() ||
                                idea.reasonDetail;
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
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <p className="line-clamp-2 text-sm font-medium leading-snug">
                                      {theme}
                                    </p>
                                    <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                                      {direction}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : null}
              </div>

        <div
          className={cn(
            "shrink-0 border-t border-border/50 py-3",
            embedded ? "px-0" : "px-6",
          )}
        >
          <Button
            type="button"
            className={autopilotPrimaryButtonClassName}
            disabled={
              selectedIds.length === 0 || ideasLoading || maxSelect <= 0
            }
            onClick={openOptionsForGenerate}
          >
            <Sparkles className="size-4" />
            {selectedIds.length === 0
              ? "Etwas auswählen"
              : selectedIds.length === 1
                ? "Als Entwurf erstellen"
                : `${selectedIds.length} als Entwürfe`}
          </Button>
        </div>
      </>
    );

  if (embedded) {
    if (!open) return null;
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col">{mainBody}</div>
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
          title="Wohin posten?"
          tone={sessionTone}
          onToneChange={setSessionTone}
          platforms={sessionPlatforms}
          onPlatformsChange={setSessionPlatforms}
          format={sessionFormat}
          onFormatChange={(next) => {
            setFormatTouched(true);
            setSessionFormat(next);
          }}
          doneLabel="Entwürfe erstellen"
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
              {phase === "creating" ? "Einen Moment …" : "KI-Post"}
            </DrawerTitle>
            <DrawerDescription>
              {phase === "creating"
                ? `${aiLabel} schreibt Bild und Text für euch.`
                : "Wählt aus Speisekarte, Galerie oder KI-Ideen — alles optional."}
            </DrawerDescription>
          </DrawerHeader>
          {mainBody}
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
        title="Wohin posten?"
        tone={sessionTone}
        onToneChange={setSessionTone}
        platforms={sessionPlatforms}
        onPlatformsChange={setSessionPlatforms}
        format={sessionFormat}
        onFormatChange={(next) => {
          setFormatTouched(true);
          setSessionFormat(next);
        }}
        doneLabel="Entwürfe erstellen"
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
