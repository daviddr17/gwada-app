"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Pencil,
  RefreshCw,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  countAutopilotIdeaActiveFilters,
  SocialAutopilotIdeasFilterDrawer,
} from "@/components/social/social-autopilot-ideas-filter-drawer";
import { SocialAutopilotOptionsDrawer } from "@/components/social/social-autopilot-options-drawer";
import { SocialTemplatePreview } from "@/components/social/social-template-preview";
import { SettingsStickySaveBar } from "@/components/settings/settings-sticky-save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  SOCIAL_FEED_LAYOUT_CHIP_LABELS,
  type SocialMediaTask,
  type SocialPostSuggestion,
  type SocialSuggestionAsset,
} from "@/lib/social/social-suggestion-types";
import {
  defaultSocialBrandKit,
  type SocialBrandKit,
  type SocialTone,
} from "@/lib/social/social-brand-kit";
import {
  DEFAULT_SOCIAL_FEED_PALETTE,
  SOCIAL_FEED_LAYOUT_IDS,
  type SocialFeedLayoutId,
} from "@/lib/social/social-feed-brand-system";
import type { SocialAutopilotIdea } from "@/lib/social/social-autopilot-ideas";
import { contentReasonFromSuggestion } from "@/lib/social/social-autopilot-relevance";
import {
  filterSocialAutopilotIdeas,
  groupSocialAutopilotIdeas,
  SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS,
  type SocialAutopilotIdeaFilter,
} from "@/lib/social/social-autopilot-idea-sort";
import { resolveSuggestionFeedLayout } from "@/lib/social/social-feed-layout";
import {
  cssAspectRatioForFormat,
  parseSocialMediaFormatId,
  SOCIAL_MEDIA_FORMATS,
  type SocialMediaFormatId,
} from "@/lib/social/social-media-formats";
import { socialPublishPlatformLabel } from "@/lib/social/social-publish-platforms";
import { isNewsPlatform, type NewsPlatform } from "@/lib/constants/news-platforms";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { cn } from "@/lib/utils";

type AiUsageSummary = {
  events30d: number;
  tokens30d: number | null;
};

type VoiceLearnDraft = {
  voiceNotes: string;
  goldCaptions: string[];
  tone: SocialTone | null;
  sampleCount: number;
  sourcePlatforms: string[];
  fromLlm: boolean;
};

type AssetOption = SocialSuggestionAsset & {
  id: string;
  group: "gallery" | "menu" | "profile" | "event";
  label: string;
};

/**
 * Klarer 3-Schritt:
 * 1 Ideen einzeln wählen → 2 Generieren → 3 Speichern / Posten / Planen
 * Kanäle & Stil = Bottom Sheet vor Generate, kein eigener Screen.
 */
type FlowStep = 1 | 2 | 3;

const FLOW_STEPS: ReadonlyArray<{ step: FlowStep; label: string; short: string }> =
  [
    { step: 1, label: "Ideen wählen", short: "Ideen" },
    { step: 2, label: "Generieren", short: "Erstellen" },
    { step: 3, label: "Handeln", short: "Handeln" },
  ];

const GROUP_LABELS: Record<AssetOption["group"], string> = {
  gallery: "Galerie",
  menu: "Speisekarte",
  profile: "Profil",
  event: "Events",
};

const layoutSelectClassName = appSelectTriggerAccentCn(staffDrawerFieldClassName);

function MetaChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

function AutopilotFlowStepper({ step }: { step: FlowStep }) {
  const current = FLOW_STEPS.find((s) => s.step === step)!;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Schritt {step}/3 · {current.label}
        </p>
        <p className="text-xs text-muted-foreground md:hidden">{current.short}</p>
      </div>
      <ol className="flex items-center gap-1" aria-label="Autopilot-Ablauf">
        {FLOW_STEPS.map((s, i) => {
          const done = s.step < step;
          const active = s.step === step;
          return (
            <li key={s.step} className="flex min-w-0 flex-1 items-center gap-1">
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                  active &&
                    "border-accent/60 bg-accent/20 text-foreground ring-2 ring-accent/30",
                  done && "border-accent/40 bg-accent/15 text-foreground",
                  !active &&
                    !done &&
                    "border-border/60 bg-card text-muted-foreground",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : s.step}
              </div>
              <span
                className={cn(
                  "hidden truncate text-[11px] font-medium sm:inline",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.short}
              </span>
              {i < FLOW_STEPS.length - 1 ? (
                <span
                  className={cn(
                    "mx-0.5 h-px min-w-2 flex-1",
                    done ? "bg-accent/40" : "bg-border/60",
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatPlan(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function platformsSummary(platforms: NewsPlatform[]): string {
  if (platforms.length === 0) return "—";
  return platforms.map(socialPublishPlatformLabel).join(", ");
}

export function SocialAutopilotScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { profile } = useRestaurantProfile();
  const [suggestions, setSuggestions] = useState<SocialPostSuggestion[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SocialPostSuggestion[]>(
    [],
  );
  const [tasks, setTasks] = useState<SocialMediaTask[]>([]);
  const [kit, setKit] = useState<SocialBrandKit | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiProvider, setAiProvider] = useState<"openai" | "grok" | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsageSummary | null>(null);
  const [voiceDraft, setVoiceDraft] = useState<VoiceLearnDraft | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>(1);
  const [ideas, setIdeas] = useState<SocialAutopilotIdea[]>([]);
  const [ideaFilter, setIdeaFilter] =
    useState<SocialAutopilotIdeaFilter>("all");
  const [ideasFilterOpen, setIdeasFilterOpen] = useState(false);
  const [maxSelect, setMaxSelect] = useState(7);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sessionTone, setSessionTone] = useState<SocialTone>("warm");
  const [sessionPlatforms, setSessionPlatforms] = useState<NewsPlatform[]>([]);
  const [sessionFormat, setSessionFormat] =
    useState<SocialMediaFormatId>("square_1x1");
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const [reviewOptionsId, setReviewOptionsId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftTitles, setDraftTitles] = useState<Record<string, string>>({});
  const [draftCaptions, setDraftCaptions] = useState<Record<string, string>>(
    {},
  );
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [actionsId, setActionsId] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const ideasBootstrapped = useRef(false);
  const showSkeleton = useDeferredSkeleton(loading);
  const showIdeasSkeleton = useDeferredSkeleton(ideasLoading);

  const applySuggestionDrafts = useCallback((list: SocialPostSuggestion[]) => {
    const nextTitles: Record<string, string> = {};
    const nextCaptions: Record<string, string> = {};
    for (const s of list) {
      nextTitles[s.id] = s.title?.trim() ?? "";
      nextCaptions[s.id] = s.caption;
    }
    setDraftTitles(nextTitles);
    setDraftCaptions(nextCaptions);
  }, []);

  const loadBase = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [sugRes, kitRes, optRes, usageRes] = await Promise.all([
        fetch(
          `/api/social/suggestions?restaurantId=${encodeURIComponent(restaurantId)}`,
        ),
        fetch(
          `/api/social/brand-kit?restaurantId=${encodeURIComponent(restaurantId)}`,
        ),
        fetch(
          `/api/social/asset-options?restaurantId=${encodeURIComponent(restaurantId)}`,
        ),
        fetch(
          `/api/social/ai-usage?restaurantId=${encodeURIComponent(restaurantId)}`,
        ),
      ]);
      const sugData = (await sugRes.json().catch(() => ({}))) as {
        suggestions?: SocialPostSuggestion[];
        saved?: SocialPostSuggestion[];
        tasks?: SocialMediaTask[];
        generation?: {
          aiConfigured?: boolean;
          aiProvider?: "openai" | "grok";
        };
      };
      const usageData = (await usageRes.json().catch(() => ({}))) as {
        usage?: AiUsageSummary;
      };
      if (usageData.usage) setAiUsage(usageData.usage);
      const kitData = (await kitRes.json().catch(() => ({}))) as {
        kit?: SocialBrandKit;
      };
      const optData = (await optRes.json().catch(() => ({}))) as {
        options?: AssetOption[];
      };
      if (!sugRes.ok) {
        toast.error("Autopilot konnte nicht geladen werden");
        return;
      }
      const list = sugData.suggestions ?? [];
      const open = list.filter(
        (s) => s.status === "pending" || s.status === "needs_asset",
      );
      setSuggestions(open);
      setSavedTemplates(sugData.saved ?? []);
      setTasks(sugData.tasks ?? []);
      const nextKit = kitData.kit ?? defaultSocialBrandKit(restaurantId);
      setKit(nextKit);
      setSessionTone(nextKit.tone);
      setSessionPlatforms(
        nextKit.publishPlatforms.length > 0
          ? [...nextKit.publishPlatforms]
          : ["instagram", "facebook"],
      );
      setSessionFormat("square_1x1");
      setAssetOptions(optData.options ?? []);
      applySuggestionDrafts(open);
      const gen = sugData.generation;
      if (typeof gen?.aiConfigured === "boolean") {
        setAiConfigured(gen.aiConfigured);
      }
      if (gen?.aiProvider === "openai" || gen?.aiProvider === "grok") {
        setAiProvider(gen.aiProvider);
      } else if (gen?.aiConfigured === false) {
        setAiProvider(null);
      }
      // Nie automatisch zu Schritt 3 — Start immer bei Ideen (Schritt 1).
      // Resume nur über expliziten Button „Offene Posts“.
    } finally {
      setLoading(false);
    }
  }, [restaurantId, applySuggestionDrafts]);

  const loadIdeas = useCallback(
    async (opts?: {
      rotate?: boolean;
      /** Offene Woche verwerfen — „Neue Vorschläge“. */
      forceSkipOpen?: boolean;
      stayOnIdeas?: boolean;
    }) => {
      if (!restaurantId || aiConfigured === false) return;
      setIdeasLoading(true);
      if (opts?.stayOnIdeas !== false) setFlowStep(1);
      try {
        const qs = new URLSearchParams({ restaurantId });
        if (opts?.rotate) qs.set("rotate", "1");
        if (opts?.forceSkipOpen) qs.set("forceSkip", "1");
        const res = await fetch(`/api/social/suggestions/ideas?${qs}`);
        const data = (await res.json().catch(() => ({}))) as {
          ideas?: SocialAutopilotIdea[];
          maxSelect?: number;
          pendingOpen?: number;
          forceSkipped?: number;
          skippedReason?: string;
          aiConfigured?: boolean;
          aiProvider?: "openai" | "grok";
        };
        if (typeof data.aiConfigured === "boolean") {
          setAiConfigured(data.aiConfigured);
        }
        if (data.aiProvider === "openai" || data.aiProvider === "grok") {
          setAiProvider(data.aiProvider);
        }
        if (!res.ok) {
          toast.error("Ideen konnten nicht geladen werden");
          return;
        }
        if (data.skippedReason === "ai_not_configured") {
          toast.error(
            "Autopilot braucht euren Restaurant-KI-Schlüssel unter Integrationen",
          );
          setFlowStep(1);
          return;
        }
        if (data.skippedReason === "disabled") {
          toast.error("Autopilot ist in der Social-Marke ausgeschaltet");
          setFlowStep(1);
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
        if (opts?.forceSkipOpen) {
          setSuggestions([]);
          applySuggestionDrafts([]);
          const skipped = data.forceSkipped ?? 0;
          if (skipped > 0) {
            toast.message(
              `${skipped} offene Entwurf${skipped === 1 ? "" : "e"} verworfen`,
            );
          }
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
            "Keine neuen Ideen — prüft Speisekarte, Galerie oder Events",
          );
        } else if (opts?.forceSkipOpen || opts?.rotate) {
          toast.message(`${next.length} Ideen zur Auswahl`);
        }
      } finally {
        setIdeasLoading(false);
      }
    },
    [restaurantId, aiConfigured, applySuggestionDrafts],
  );

  useEffect(() => {
    if (!ready || !restaurantId) return;
    void loadBase();
  }, [ready, restaurantId, loadBase]);

  useEffect(() => {
    if (!ready || !restaurantId || loading) return;
    if (aiConfigured !== true) return;
    if (ideasBootstrapped.current) return;
    ideasBootstrapped.current = true;
    // Bootstrap Ideen — ohne Force-Skip, ohne Sprung zu Handeln.
    void loadIdeas({ rotate: true, stayOnIdeas: true });
  }, [ready, restaurantId, loading, aiConfigured, loadIdeas]);

  const toggleIdea = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxSelect) {
        toast.message(`Maximal ${maxSelect} Ideen auf einmal`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const openGenerateOptions = () => {
    if (selectedIds.length === 0) {
      toast.message("Bitte mindestens eine Idee auswählen");
      return;
    }
    if (maxSelect <= 0) {
      toast.message(
        "Wochenziel voll — erst offene Posts handeln oder neue Vorschläge",
      );
      return;
    }
    setOptionsSheetOpen(true);
  };

  const createFromSelection = async () => {
    if (!restaurantId || selectedIds.length === 0) return;
    setOptionsSheetOpen(false);
    setFlowStep(2);
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
        setFlowStep(1);
        return;
      }
      const gen = data.generation;
      if (gen?.skippedReason === "needs_media") {
        toast.error("Für die Auswahl fehlen Bilder");
        setFlowStep(1);
        return;
      }
      if (gen?.skippedReason === "week_full") {
        toast.message(
          "Wochenziel voll — offene Posts freigeben oder neue Vorschläge",
        );
        setFlowStep(1);
        return;
      }
      await loadBase();
      setIdeas([]);
      setSelectedIds([]);
      const created = gen?.created ?? 0;
      if (created > 0) {
        setFlowStep(3);
        const llmHint =
          (gen?.llmApplied ?? 0) > 0
            ? " · Texte mit eurer Restaurant-KI"
            : " · Vorlagen";
        toast.success(`${created} Posts erstellt${llmHint}`);
      } else {
        toast.message("Keine Posts erstellt");
        setFlowStep(1);
      }
    } catch {
      toast.error("Erstellen fehlgeschlagen");
      setFlowStep(1);
    }
  };

  const patchSuggestion = useCallback(
    async (
      id: string,
      patch: {
        title?: string | null;
        caption?: string;
        asset?: SocialSuggestionAsset;
        feedLayout?: SocialFeedLayoutId;
        platforms?: NewsPlatform[];
        mediaFormat?: SocialMediaFormatId | null;
      },
    ) => {
      if (!restaurantId) return;
      const res = await fetch(`/api/social/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, ...patch }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        suggestion?: SocialPostSuggestion;
      };
      if (!res.ok || !data.suggestion) {
        toast.error("Änderung konnte nicht gespeichert werden");
        return;
      }
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? data.suggestion! : s)),
      );
      setSavedTemplates((prev) =>
        prev.map((s) => (s.id === id ? data.suggestion! : s)),
      );
    },
    [restaurantId],
  );

  const scheduleTextSave = useCallback(
    (id: string, next: { title: string; caption: string }) => {
      if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
      saveTimers.current[id] = setTimeout(() => {
        void patchSuggestion(id, {
          title: next.title.trim() || null,
          caption: next.caption,
        });
      }, 500);
    },
    [patchSuggestion],
  );

  const preferredLayouts = useMemo(() => {
    const fromKit = kit?.preferredLayouts ?? [];
    return fromKit.length > 0 ? fromKit : [...SOCIAL_FEED_LAYOUT_IDS];
  }, [kit?.preferredLayouts]);

  const layoutForSuggestion = useCallback(
    (s: SocialPostSuggestion): SocialFeedLayoutId =>
      resolveSuggestionFeedLayout({
        slotKind: s.slotKind,
        templateId: s.templateId,
        source: s.source,
        preferredLayouts,
      }),
    [preferredLayouts],
  );

  const approve = async (id: string, publishNow: boolean) => {
    if (!restaurantId) return;
    setBusyId(id);
    try {
      if (saveTimers.current[id]) {
        clearTimeout(saveTimers.current[id]);
        delete saveTimers.current[id];
      }
      await patchSuggestion(id, {
        title: (draftTitles[id] ?? "").trim() || null,
        caption: draftCaptions[id] ?? "",
      });
      const res = await fetch(`/api/social/suggestions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          caption: draftCaptions[id],
          publishNow,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        published?: boolean;
      };
      if (!res.ok) {
        toast.error(
          data.error === "image_required"
            ? "Für die Freigabe fehlt noch ein Bild"
            : "Freigabe fehlgeschlagen",
        );
        return;
      }
      toast.success(
        data.published
          ? "Post freigegeben und veröffentlicht"
          : "Post freigegeben (geplant)",
      );
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setActionsId(null);
      setEditId(null);
    } finally {
      setBusyId(null);
    }
  };

  const skip = async (id: string) => {
    if (!restaurantId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/social/suggestions/${id}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) {
        toast.error("Verwerfen fehlgeschlagen");
        return;
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setActionsId(null);
      setEditId(null);
    } finally {
      setBusyId(null);
    }
  };

  const completeTask = async (id: string, status: "done" | "dismissed") => {
    if (!restaurantId) return;
    const res = await fetch(`/api/social/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, status }),
    });
    if (!res.ok) {
      toast.error("Aufgabe konnte nicht aktualisiert werden");
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const saveAsTemplate = async (id: string) => {
    if (!restaurantId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/social/suggestions/${id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) {
        toast.error("Vorlage speichern fehlgeschlagen");
        return;
      }
      toast.success(
        "Als Vorlage gespeichert — du kannst parallel weiter erstellen",
      );
      await loadBase();
      setFlowStep(1);
      void loadIdeas({ rotate: true, stayOnIdeas: true });
    } finally {
      setBusyId(null);
    }
  };

  const restoreTemplate = async (id: string) => {
    if (!restaurantId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/social/suggestions/${id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) {
        toast.error("Vorlage konnte nicht geöffnet werden");
        return;
      }
      toast.success("Vorlage bereit — speichern, posten oder planen");
      await loadBase();
      setFlowStep(3);
    } finally {
      setBusyId(null);
    }
  };

  const learnVoice = async () => {
    if (!restaurantId) return;
    setVoiceBusy(true);
    try {
      const res = await fetch("/api/social/brand-kit/learn-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        draft?: VoiceLearnDraft;
        error?: string;
      };
      if (!res.ok) {
        toast.error(
          data.error === "not_enough_posts"
            ? "Zu wenig IG/FB-Posts im Cache — zuerst News syncen"
            : "Stimme konnte nicht gelernt werden",
        );
        return;
      }
      if (data.draft) setVoiceDraft(data.draft);
      const usageRes = await fetch(
        `/api/social/ai-usage?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      const usageData = (await usageRes.json().catch(() => ({}))) as {
        usage?: AiUsageSummary;
      };
      if (usageData.usage) setAiUsage(usageData.usage);
    } finally {
      setVoiceBusy(false);
    }
  };

  const confirmVoiceDraft = async () => {
    if (!restaurantId || !kit || !voiceDraft) return;
    setVoiceBusy(true);
    try {
      const nextKit: SocialBrandKit = {
        ...kit,
        voiceNotes: voiceDraft.voiceNotes,
        goldCaptions:
          voiceDraft.goldCaptions.length > 0
            ? voiceDraft.goldCaptions
            : kit.goldCaptions,
        tone: voiceDraft.tone ?? kit.tone,
      };
      const res = await fetch("/api/social/brand-kit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, kit: nextKit }),
      });
      if (!res.ok) {
        toast.error("Social-Marke konnte nicht gespeichert werden");
        return;
      }
      setKit(nextKit);
      if (voiceDraft.tone) setSessionTone(voiceDraft.tone);
      setVoiceDraft(null);
      toast.success("Stimme in Social-Marke übernommen");
    } finally {
      setVoiceBusy(false);
    }
  };

  const filteredIdeas = useMemo(
    () => filterSocialAutopilotIdeas(ideas, ideaFilter),
    [ideas, ideaFilter],
  );
  const ideaGroups = useMemo(
    () => groupSocialAutopilotIdeas(filteredIdeas),
    [filteredIdeas],
  );
  const ideaFilterActiveCount = countAutopilotIdeaActiveFilters(ideaFilter);

  const sortedSuggestions = useMemo(
    () =>
      [...suggestions].sort((a, b) => a.plannedAt.localeCompare(b.plannedAt)),
    [suggestions],
  );

  const reviewTarget = reviewOptionsId
    ? suggestions.find((s) => s.id === reviewOptionsId) ?? null
    : null;

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  const restaurantName = profile?.name?.trim() || "Restaurant";
  const feedPalette = kit?.feedPalette ?? DEFAULT_SOCIAL_FEED_PALETTE;
  const photoLook = kit?.photoLook ?? "warm";
  const publishStories = kit?.publishStories !== false;
  const ctaLabel = kit?.cta ?? "Tisch reservieren";
  const logoUrl =
    assetOptions.find((o) => o.id === "profile:avatar")?.imageUrl ??
    assetOptions.find((o) => o.id === "profile:cover")?.imageUrl ??
    null;

  const editing = editId
    ? suggestions.find((s) => s.id === editId) ?? null
    : null;
  const acting = actionsId
    ? suggestions.find((s) => s.id === actionsId) ?? null
    : null;

  const aiReady = aiConfigured === true;
  const aiLabel =
    aiProvider === "grok"
      ? "Grok"
      : aiProvider === "openai"
        ? "OpenAI"
        : "Restaurant-KI";

  const showStickyIdeasCta =
    aiReady &&
    flowStep === 1 &&
    !showIdeasSkeleton &&
    ideas.length > 0 &&
    !optionsSheetOpen;

  return (
    <div className="space-y-5 pb-4">
      {!showSkeleton ? <AutopilotFlowStepper step={flowStep} /> : null}

      {showSkeleton ? (
        <div className="space-y-4" aria-busy>
          {[0, 1].map((i) => (
            <SkeletonCardFrame key={i} className="space-y-3">
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
            </SkeletonCardFrame>
          ))}
        </div>
      ) : null}

      {/* KI-Gate — ohne Key kein Ideen-Flow */}
      {!showSkeleton && aiConfigured === false ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="space-y-3 pt-5">
            <div className="space-y-1">
              <p className="text-sm font-medium">Euer KI-Abo fehlt</p>
              <p className="text-sm text-muted-foreground">
                Autopilot schreibt Captions mit demselben OpenAI- oder
                Grok-Schlüssel wie der Restaurant-Assistent — euer Abo, eure
                Kosten. Ohne Schlüssel entstehen keine Posts.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              className={cn("w-full", brandActionButtonRoundedClassName)}
              render={<Link href={APP_ROUTES.settings.integrations} />}
            >
              KI unter Integrationen verbinden
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tasks.length > 0 && !showSkeleton && flowStep === 1 ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id} className="border-border/50 shadow-card">
              <CardContent className="space-y-3 pt-5">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {task.body}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="lg"
                    className={cn("w-full", brandActionButtonRoundedClassName)}
                    render={<Link href={APP_ROUTES.galerie.overview} />}
                  >
                    Zur Galerie
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 flex-1 rounded-xl"
                      onClick={() => void completeTask(task.id, "done")}
                    >
                      Erledigt
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 flex-1 rounded-xl"
                      onClick={() => void completeTask(task.id, "dismissed")}
                    >
                      Später
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Schritt 1 — Ideen einzeln wählen */}
      {!showSkeleton && aiReady && flowStep === 1 ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              Ideen auswählen
            </p>
            <p className="text-xs text-muted-foreground">
              Karten tippen · generieren · dann speichern, posten oder planen.
              Texte: <span className="text-foreground">{aiLabel}</span>
              {maxSelect > 0 ? ` · max. ${maxSelect}` : ""}.
            </p>
            {aiUsage ? (
              <p className="text-xs text-muted-foreground">
                Verbrauch · {aiUsage.events30d} KI-Läufe (30 Tage)
                {aiUsage.tokens30d != null
                  ? ` · ~${aiUsage.tokens30d.toLocaleString("de-DE")} Tokens`
                  : ""}
              </p>
            ) : null}
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl border-border/60"
                disabled={ideasLoading}
                onClick={() =>
                  void loadIdeas({ rotate: true, forceSkipOpen: true })
                }
              >
                <RefreshCw
                  className={cn("size-3.5", ideasLoading && "animate-spin")}
                />
                Neue Vorschläge
              </Button>
            </div>
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

          {suggestions.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-border/60"
              onClick={() => setFlowStep(3)}
            >
              Offene Posts öffnen ({suggestions.length})
              <ChevronRight className="size-4" />
            </Button>
          ) : null}

          {maxSelect <= 0 && suggestions.length > 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-center text-xs text-muted-foreground">
              Wochenziel voll mit offenen Entwürfen — erst handeln oder „Neue
              Vorschläge“ (verwirft offene Woche).
            </p>
          ) : null}

          {ideaFilter !== "all" ? (
            <p className="text-xs text-muted-foreground">
              Filter:{" "}
              <span className="font-medium text-foreground">
                {SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS[ideaFilter]}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sortierung: Events → Speisekarte → Galerie → Feiertag → Marke
            </p>
          )}

          {showIdeasSkeleton ? (
            <div className="grid grid-cols-2 gap-3" aria-busy>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <SkeletonCardFrame key={i} className="space-y-2 p-2">
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-3 w-3/4" />
                </SkeletonCardFrame>
              ))}
            </div>
          ) : ideas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
              Noch keine Ideen. „Neue Vorschläge“ lädt Speisekarte, Galerie und
              nahe Events — und verwirft offene Entwürfe der Woche.
            </p>
          ) : filteredIdeas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
              Keine Ideen in diesem Filter.
            </p>
          ) : (
            <div className="space-y-5">
              {ideaGroups.map((group) => (
                <div key={group.slotKind} className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {group.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{group.hint}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {group.ideas.map((idea) => {
                      const selected = selectedIds.includes(idea.id);
                      return (
                        <button
                          key={idea.id}
                          type="button"
                          onClick={() => toggleIdea(idea.id)}
                          aria-pressed={selected}
                          className={cn(
                            "overflow-hidden rounded-xl border text-left touch-manipulation transition-colors",
                            selected
                              ? "border-accent ring-2 ring-accent/40"
                              : "border-border/50 hover:border-border",
                          )}
                        >
                          <div className="relative aspect-square bg-muted/40">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={idea.imageUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                            {selected ? (
                              <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
                                <Check className="size-3.5" />
                              </span>
                            ) : null}
                          </div>
                          <div className="space-y-0.5 px-2.5 py-2">
                            <p className="text-[11px] font-medium text-muted-foreground">
                              {idea.reasonLabel}
                            </p>
                            <p className="line-clamp-2 text-xs font-medium text-foreground">
                              {idea.reasonDetail}
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

          {savedTemplates.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Vorlagen</p>
              <div className="grid grid-cols-2 gap-3">
                {savedTemplates.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => void restoreTemplate(s.id)}
                    className="overflow-hidden rounded-xl border border-border/50 text-left touch-manipulation transition-colors hover:border-border"
                  >
                    <div className="relative aspect-square bg-muted/40">
                      {s.asset.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.asset.imageUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="space-y-0.5 px-2.5 py-2">
                      <p className="line-clamp-1 text-xs font-medium">
                        {s.title?.trim() || "Vorlage"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Speichern / posten / planen
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-border/60"
              disabled={voiceBusy}
              onClick={() => void learnVoice()}
            >
              {voiceBusy ? "Lerne …" : "Stimme aus Social lernen"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-border/60"
              render={<Link href={APP_ROUTES.settings.restaurant} />}
            >
              Social-Marke
            </Button>
          </div>
          {voiceDraft ? (
            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-3">
              <p className="text-xs font-medium text-foreground">
                Vorschlag aus {voiceDraft.sampleCount} Posts
                {voiceDraft.fromLlm ? ` · ${aiLabel}` : " · Heuristik"}
              </p>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                {voiceDraft.voiceNotes}
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="sm"
                  className={cn(
                    "h-11 w-full rounded-xl",
                    brandActionButtonRoundedClassName,
                  )}
                  disabled={voiceBusy}
                  onClick={() => void confirmVoiceDraft()}
                >
                  In Social-Marke übernehmen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full rounded-xl"
                  onClick={() => setVoiceDraft(null)}
                >
                  Verwerfen
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Schritt 2 — Generieren */}
      {flowStep === 2 ? (
        <div className="space-y-4" aria-busy>
          <p className="text-sm text-muted-foreground">
            {aiLabel} schreibt Captions für eure Auswahl …
          </p>
          {[0, 1, 2].map((i) => (
            <SkeletonCardFrame key={i} className="space-y-3">
              <Skeleton className="mx-auto aspect-square w-full max-w-md rounded-xl" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </SkeletonCardFrame>
          ))}
        </div>
      ) : null}

      {/* Schritt 3 — Speichern / Posten / Planen */}
      {!showSkeleton && flowStep === 3 ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Speichern, posten oder planen
            </p>
            <p className="text-xs text-muted-foreground">
              Geplant zuerst · prüfen, Kanäle im Sheet, dann Vorlage speichern,
              jetzt posten oder planen — oder neue Vorschläge.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-xl text-muted-foreground"
            onClick={() => setFlowStep(1)}
          >
            <ChevronLeft className="size-4" />
            Zurück zu Ideen
          </Button>

          {sortedSuggestions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
              Keine offenen Posts. Lade neue Ideen, um weiterzumachen.
            </p>
          ) : (
            <div className="space-y-5">
              {sortedSuggestions.map((s) => {
                const title = draftTitles[s.id] ?? s.title?.trim() ?? "";
                const caption = draftCaptions[s.id] ?? s.caption;
                const layout = layoutForSuggestion(s);
                const reason = contentReasonFromSuggestion({
                  slotKind: s.slotKind,
                  title: s.title,
                  assetLabel: s.asset.imageLabel ?? null,
                  source: s.source,
                });
                const mediaFormat =
                  parseSocialMediaFormatId(s.source.mediaFormat) ??
                  sessionFormat;
                const sourceLabel =
                  s.asset.source === "gallery"
                    ? "Galerie"
                    : s.asset.source === "menu"
                      ? "Speisekarte"
                      : s.asset.source === "event"
                        ? "Event"
                        : s.asset.source === "profile"
                          ? "Profil / Logo"
                          : "Bild fehlt";
                const activePlatforms = s.platforms.filter(isNewsPlatform);
                return (
                  <Card
                    key={s.id}
                    className="overflow-hidden border-border/50 shadow-card"
                  >
                    <CardContent className="space-y-4 pt-5">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <MetaChip className="border-accent/40 bg-accent/10 text-foreground">
                            {reason.label}
                          </MetaChip>
                          <MetaChip>{sourceLabel}</MetaChip>
                          <MetaChip>
                            {SOCIAL_FEED_LAYOUT_CHIP_LABELS[layout]}
                          </MetaChip>
                          <MetaChip>{formatPlan(s.plannedAt)}</MetaChip>
                          {s.status === "needs_asset" || !s.asset.imageUrl ? (
                            <MetaChip className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
                              Bild fehlt
                            </MetaChip>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Bezug: {reason.detail}
                        </p>
                      </div>

                      <div
                        className="mx-auto w-full max-w-md"
                        style={{
                          aspectRatio: cssAspectRatioForFormat(mediaFormat),
                        }}
                      >
                        <SocialTemplatePreview
                          feedLayout={layout}
                          feedPalette={feedPalette}
                          photoLook={photoLook}
                          restaurantName={restaurantName}
                          title={title}
                          caption={caption}
                          ctaLabel={ctaLabel}
                          imageUrl={s.asset.imageUrl}
                          logoUrl={logoUrl}
                          className="!aspect-auto size-full max-h-none"
                        />
                      </div>

                      <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-3">
                        <SummaryRow
                          label="Kanäle"
                          value={platformsSummary(activePlatforms)}
                        />
                        <SummaryRow
                          label="Format"
                          value={SOCIAL_MEDIA_FORMATS[mediaFormat].ratioLabel}
                        />
                        {publishStories &&
                        (activePlatforms.includes("facebook") ||
                          activePlatforms.includes("instagram")) ? (
                          <p className="text-[11px] text-muted-foreground">
                            + Story 9:16 beim Publish
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 w-full rounded-xl border-border/60"
                          disabled={busyId === s.id}
                          onClick={() => setReviewOptionsId(s.id)}
                        >
                          Kanäle & Format …
                        </Button>
                      </div>

                      <div className="space-y-1">
                        {title ? (
                          <p className="text-sm font-medium text-foreground">
                            {title}
                          </p>
                        ) : null}
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {caption || "Kein Text"}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          size="lg"
                          className={cn(
                            "w-full",
                            brandActionButtonRoundedClassName,
                          )}
                          disabled={busyId === s.id}
                          onClick={() => setActionsId(s.id)}
                        >
                          <Check className="size-4" />
                          Posten / Planen …
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 w-full rounded-xl"
                          disabled={busyId === s.id}
                          onClick={() => setEditId(s.id)}
                        >
                          <Pencil className="size-4" />
                          Bearbeiten
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 w-full rounded-xl"
                          disabled={busyId === s.id}
                          onClick={() => void saveAsTemplate(s.id)}
                        >
                          <Bookmark className="size-4" />
                          Als Vorlage speichern
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-11 w-full rounded-xl text-muted-foreground"
                          disabled={busyId === s.id}
                          onClick={() => void skip(s.id)}
                        >
                          <SkipForward className="size-4" />
                          Verwerfen
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
            onClick={() =>
              void loadIdeas({ rotate: true, forceSkipOpen: true })
            }
          >
            <Sparkles className="size-4" />
            Neue Vorschläge
          </Button>
        </div>
      ) : null}

      <SettingsStickySaveBar show={showStickyIdeasCta}>
        <Button
          type="button"
          size="lg"
          className={cn("w-full", brandActionButtonRoundedClassName)}
          disabled={
            selectedIds.length === 0 || ideasLoading || maxSelect <= 0
          }
          onClick={openGenerateOptions}
        >
          {selectedIds.length === 0
            ? "Ideen auswählen"
            : `Generieren · ${selectedIds.length} ausgewählt`}
          <ChevronRight className="size-4" />
        </Button>
      </SettingsStickySaveBar>

      <SocialAutopilotIdeasFilterDrawer
        open={ideasFilterOpen}
        onOpenChange={setIdeasFilterOpen}
        ideas={ideas}
        filter={ideaFilter}
        onFilterChange={setIdeaFilter}
      />

      <SocialAutopilotOptionsDrawer
        open={optionsSheetOpen && flowStep === 1}
        onOpenChange={setOptionsSheetOpen}
        title="Kanäle & Stil · dann generieren"
        tone={sessionTone}
        onToneChange={setSessionTone}
        platforms={sessionPlatforms}
        onPlatformsChange={setSessionPlatforms}
        format={sessionFormat}
        onFormatChange={setSessionFormat}
        doneLabel="Generieren"
        onDone={() => void createFromSelection()}
        defaults={{
          tone: kit?.tone ?? "warm",
          platforms:
            kit?.publishPlatforms && kit.publishPlatforms.length > 0
              ? [...kit.publishPlatforms]
              : ["instagram", "facebook"],
          format: "square_1x1",
        }}
      />

      {reviewTarget ? (
        <SocialAutopilotOptionsDrawer
          open
          onOpenChange={(open) => {
            if (!open) setReviewOptionsId(null);
          }}
          title="Kanäle & Format"
          showTone={false}
          tone={sessionTone}
          onToneChange={setSessionTone}
          platforms={reviewTarget.platforms.filter(isNewsPlatform)}
          onPlatformsChange={(next) => {
            void patchSuggestion(reviewTarget.id, { platforms: next });
          }}
          format={
            parseSocialMediaFormatId(reviewTarget.source.mediaFormat) ??
            sessionFormat
          }
          onFormatChange={(next) => {
            void patchSuggestion(reviewTarget.id, { mediaFormat: next });
          }}
        />
      ) : null}

      <Drawer
        direction="bottom"
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditId(null);
        }}
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("form")}>
          <DrawerHeader className="text-left">
            <DrawerTitle>Vorschlag bearbeiten</DrawerTitle>
            <DrawerDescription>
              Bild, Layout, Titel und Caption anpassen.
            </DrawerDescription>
          </DrawerHeader>
          {editing ? (
            <div className={drawerScrollAreaClassName(6)}>
              <div className="space-y-5 pb-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Bildquelle
                  </Label>
                  {(["gallery", "menu", "profile", "event"] as const).map(
                    (group) => {
                      const items = assetOptions.filter(
                        (o) => o.group === group,
                      );
                      if (items.length === 0) return null;
                      return (
                        <div key={group} className="space-y-1.5">
                          <p className="text-[11px] font-medium text-muted-foreground">
                            {GROUP_LABELS[group]} · {items.length}
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {items.map((opt) => {
                              const selected =
                                editing.asset.source === opt.source &&
                                editing.asset.sourceId === opt.sourceId;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  title={opt.label}
                                  className={cn(
                                    "relative aspect-square overflow-hidden rounded-xl border touch-manipulation transition-colors",
                                    selected
                                      ? "border-accent ring-2 ring-accent/40"
                                      : "border-border/50 hover:border-border",
                                  )}
                                  onClick={() => {
                                    void patchSuggestion(editing.id, {
                                      asset: {
                                        imageUrl: opt.imageUrl,
                                        imageLabel: opt.imageLabel,
                                        source: opt.source,
                                        sourceId: opt.sourceId,
                                        storageBucket: opt.storageBucket,
                                        storagePath: opt.storagePath,
                                      },
                                    });
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={opt.imageUrl ?? ""}
                                    alt=""
                                    className="size-full object-cover"
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Layout</Label>
                  <SearchableSelect
                    value={layoutForSuggestion(editing)}
                    onValueChange={(v) => {
                      if (
                        preferredLayouts.includes(v as SocialFeedLayoutId)
                      ) {
                        void patchSuggestion(editing.id, {
                          feedLayout: v as SocialFeedLayoutId,
                        });
                      }
                    }}
                    options={preferredLayouts.map((id) => ({
                      value: id,
                      label: SOCIAL_FEED_LAYOUT_CHIP_LABELS[id],
                    }))}
                    placeholder="Layout wählen"
                    className={layoutSelectClassName}
                    side="top"
                    aria-label="Feed-Layout"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`edit-title-${editing.id}`}>Titel</Label>
                  <Input
                    id={`edit-title-${editing.id}`}
                    value={draftTitles[editing.id] ?? ""}
                    onChange={(e) => {
                      const nextTitle = e.target.value;
                      setDraftTitles((prev) => ({
                        ...prev,
                        [editing.id]: nextTitle,
                      }));
                      scheduleTextSave(editing.id, {
                        title: nextTitle,
                        caption: draftCaptions[editing.id] ?? "",
                      });
                    }}
                    className="h-11 rounded-xl"
                    placeholder="Überschrift auf dem Post"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`edit-caption-${editing.id}`}>
                    Text / Caption
                  </Label>
                  <Textarea
                    id={`edit-caption-${editing.id}`}
                    value={draftCaptions[editing.id] ?? ""}
                    onChange={(e) => {
                      const nextCaption = e.target.value;
                      setDraftCaptions((prev) => ({
                        ...prev,
                        [editing.id]: nextCaption,
                      }));
                      scheduleTextSave(editing.id, {
                        title: draftTitles[editing.id] ?? "",
                        caption: nextCaption,
                      });
                    }}
                    className="min-h-28 rounded-xl"
                  />
                </div>
              </div>
            </div>
          ) : null}
          <DrawerFooter>
            <Button
              type="button"
              className={cn("w-full", brandActionButtonRoundedClassName)}
              onClick={() => setEditId(null)}
            >
              Fertig
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        direction="bottom"
        open={Boolean(acting)}
        onOpenChange={(open) => {
          if (!open) setActionsId(null);
        }}
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("export")}>
          <DrawerHeader className="text-left">
            <DrawerTitle>Posten oder planen</DrawerTitle>
            <DrawerDescription>
              Sofort veröffentlichen oder zum geplanten Zeitpunkt freigeben.
              Vorlage speichern bleibt parallel möglich.
            </DrawerDescription>
          </DrawerHeader>
          {acting ? (
            <div className="flex flex-col gap-2 px-6 pb-2">
              <Button
                type="button"
                size="lg"
                className={cn("w-full", brandActionButtonRoundedClassName)}
                disabled={
                  busyId === acting.id || acting.status === "needs_asset"
                }
                onClick={() => void approve(acting.id, true)}
              >
                <Check className="size-4" />
                Jetzt posten
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-xl"
                disabled={busyId === acting.id}
                onClick={() => void approve(acting.id, false)}
              >
                Planen
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full rounded-xl"
                disabled={busyId === acting.id}
                onClick={() => setActionsId(null)}
              >
                Abbrechen
              </Button>
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
