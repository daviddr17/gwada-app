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
  Pencil,
  SkipForward,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { SocialAutopilotGenerateDrawer } from "@/components/social/social-autopilot-generate-drawer";
import { SocialAutopilotOptionsDrawer } from "@/components/social/social-autopilot-options-drawer";
import { SocialTemplatePreview } from "@/components/social/social-template-preview";
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
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  autopilotGhostButtonClassName,
  autopilotGhostButtonFlexClassName,
  autopilotPrimaryButtonClassName,
  autopilotSecondaryButtonClassName,
  autopilotSecondaryButtonFlexClassName,
} from "@/lib/ui/social-autopilot-buttons";
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
import { contentReasonFromSuggestion } from "@/lib/social/social-autopilot-relevance";
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

/**
 * Hauptseite = Neu generieren + Entwürfe/Designs.
 * Ideen leben nur im Generate-Bottom-Sheet (Idee ≠ Entwurf).
 */
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
  const [generateOpen, setGenerateOpen] = useState(false);
  const [sessionTone, setSessionTone] = useState<SocialTone>("warm");
  const [sessionPlatforms, setSessionPlatforms] = useState<NewsPlatform[]>([]);
  const [sessionFormat, setSessionFormat] =
    useState<SocialMediaFormatId>("square_1x1");
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
  const showSkeleton = useDeferredSkeleton(loading);

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

  const loadBase = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!restaurantId) return;
    if (!opts?.quiet) setLoading(true);
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
      if (!opts?.quiet) {
        setSessionTone(nextKit.tone);
        setSessionPlatforms(
          nextKit.publishPlatforms.length > 0
            ? [...nextKit.publishPlatforms]
            : ["instagram", "facebook"],
        );
        setSessionFormat("square_1x1");
      }
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
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [restaurantId, applySuggestionDrafts]);

  const refreshDraftsAfterGenerate = useCallback(async () => {
    await loadBase({ quiet: true });
  }, [loadBase]);

  useEffect(() => {
    if (!ready || !restaurantId) return;
    void loadBase();
  }, [ready, restaurantId, loadBase]);

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
      let snapshot: SocialPostSuggestion | undefined;
      const applyLocal = (s: SocialPostSuggestion): SocialPostSuggestion => {
        const next: SocialPostSuggestion = { ...s };
        if (patch.title !== undefined) next.title = patch.title;
        if (patch.caption !== undefined) next.caption = patch.caption;
        if (patch.asset !== undefined) next.asset = patch.asset;
        if (patch.feedLayout !== undefined) next.feedLayout = patch.feedLayout;
        if (patch.platforms !== undefined) next.platforms = patch.platforms;
        if (patch.mediaFormat !== undefined) {
          next.source = { ...next.source, mediaFormat: patch.mediaFormat };
        }
        return next;
      };
      setSuggestions((prev) => {
        snapshot = prev.find((s) => s.id === id);
        if (!snapshot) return prev;
        return prev.map((s) => (s.id === id ? applyLocal(s) : s));
      });
      setSavedTemplates((prev) => {
        const hit = prev.find((s) => s.id === id);
        if (hit && !snapshot) snapshot = hit;
        if (!hit) return prev;
        return prev.map((s) => (s.id === id ? applyLocal(s) : s));
      });
      const res = await fetch(`/api/social/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, ...patch }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        suggestion?: SocialPostSuggestion;
      };
      if (!res.ok || !data.suggestion) {
        if (snapshot) {
          const roll = snapshot;
          setSuggestions((prev) =>
            prev.map((s) => (s.id === id ? roll : s)),
          );
          setSavedTemplates((prev) =>
            prev.map((s) => (s.id === id ? roll : s)),
          );
        }
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
    if (saveTimers.current[id]) {
      clearTimeout(saveTimers.current[id]);
      delete saveTimers.current[id];
    }
    const caption = draftCaptions[id] ?? "";
    const title = (draftTitles[id] ?? "").trim() || null;
    let removed: SocialPostSuggestion | undefined;
    setSuggestions((prev) => {
      removed = prev.find((s) => s.id === id);
      return prev.filter((s) => s.id !== id);
    });
    setActionsId(null);
    setEditId(null);
    setBusyId(id);
    try {
      await fetch(`/api/social/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, title, caption }),
      });
      const res = await fetch(`/api/social/suggestions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, caption, publishNow }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        published?: boolean;
      };
      if (!res.ok) {
        if (removed) setSuggestions((prev) => [removed!, ...prev]);
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
    } finally {
      setBusyId(null);
    }
  };

  const skip = async (id: string) => {
    if (!restaurantId) return;
    let removed: SocialPostSuggestion | undefined;
    setSuggestions((prev) => {
      removed = prev.find((s) => s.id === id);
      return prev.filter((s) => s.id !== id);
    });
    setActionsId(null);
    setEditId(null);
    try {
      const res = await fetch(`/api/social/suggestions/${id}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) {
        if (removed) setSuggestions((prev) => [removed!, ...prev]);
        toast.error("Verwerfen fehlgeschlagen");
      }
    } catch {
      if (removed) setSuggestions((prev) => [removed!, ...prev]);
      toast.error("Verwerfen fehlgeschlagen");
    }
  };

  const completeTask = async (id: string, status: "done" | "dismissed") => {
    if (!restaurantId) return;
    let removed: SocialMediaTask | undefined;
    setTasks((prev) => {
      removed = prev.find((task) => task.id === id);
      return prev.filter((task) => task.id !== id);
    });
    try {
      const res = await fetch(`/api/social/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, status }),
      });
      if (!res.ok) {
        if (removed) setTasks((prev) => [removed!, ...prev]);
        toast.error("Aufgabe konnte nicht aktualisiert werden");
      }
    } catch {
      if (removed) setTasks((prev) => [removed!, ...prev]);
      toast.error("Aufgabe konnte nicht aktualisiert werden");
    }
  };

  const saveAsTemplate = async (id: string) => {
    if (!restaurantId) return;
    let removed: SocialPostSuggestion | undefined;
    setSuggestions((prev) => {
      removed = prev.find((s) => s.id === id);
      return prev.filter((s) => s.id !== id);
    });
    if (removed) {
      const saved: SocialPostSuggestion = { ...removed, status: "saved" };
      setSavedTemplates((prev) => [saved, ...prev.filter((s) => s.id !== id)]);
    }
    setActionsId(null);
    setEditId(null);
    try {
      const res = await fetch(`/api/social/suggestions/${id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) {
        if (removed) {
          setSuggestions((prev) => [removed!, ...prev]);
          setSavedTemplates((prev) => prev.filter((s) => s.id !== id));
        }
        toast.error("Zwischenspeichern fehlgeschlagen");
        return;
      }
      toast.success("Als Design gespeichert — bleibt auf der Hauptseite");
    } catch {
      if (removed) {
        setSuggestions((prev) => [removed!, ...prev]);
        setSavedTemplates((prev) => prev.filter((s) => s.id !== id));
      }
      toast.error("Zwischenspeichern fehlgeschlagen");
    }
  };

  const restoreTemplate = async (id: string) => {
    if (!restaurantId) return;
    let removed: SocialPostSuggestion | undefined;
    setSavedTemplates((prev) => {
      removed = prev.find((s) => s.id === id);
      return prev.filter((s) => s.id !== id);
    });
    if (removed) {
      const draft: SocialPostSuggestion = {
        ...removed,
        status: removed.asset.imageUrl ? "pending" : "needs_asset",
      };
      setSuggestions((prev) => [draft, ...prev.filter((s) => s.id !== id)]);
      setDraftTitles((prev) => ({
        ...prev,
        [id]: draft.title?.trim() ?? "",
      }));
      setDraftCaptions((prev) => ({
        ...prev,
        [id]: draft.caption,
      }));
    }
    try {
      const res = await fetch(`/api/social/suggestions/${id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) {
        if (removed) {
          setSavedTemplates((prev) => [removed!, ...prev]);
          setSuggestions((prev) => prev.filter((s) => s.id !== id));
        }
        toast.error("Design konnte nicht geöffnet werden");
        return;
      }
      toast.success("Design als Entwurf bereit — posten oder planen");
    } catch {
      if (removed) {
        setSavedTemplates((prev) => [removed!, ...prev]);
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      }
      toast.error("Design konnte nicht geöffnet werden");
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

  return (
    <div className="space-y-5 pb-4">
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
              className={autopilotPrimaryButtonClassName}
              render={<Link href={APP_ROUTES.settings.integrations} />}
            >
              KI unter Integrationen verbinden
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!showSkeleton && aiReady ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              Entwürfe & Designs
            </p>
            <p className="text-xs text-muted-foreground">
              „Neu generieren“ wählt Ideen im Sheet. Ergebnis = Entwurf hier —
              jederzeit speichern, posten oder planen. Texte:{" "}
              <span className="text-foreground">{aiLabel}</span>.
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

          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
            onClick={() => setGenerateOpen(true)}
          >
            <Sparkles className="size-4" />
            Neu generieren
          </Button>
        </div>
      ) : null}

      {tasks.length > 0 && !showSkeleton ? (
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
                    className={autopilotPrimaryButtonClassName}
                    render={<Link href={APP_ROUTES.galerie.overview} />}
                  >
                    Zur Galerie
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={autopilotSecondaryButtonFlexClassName}
                      onClick={() => void completeTask(task.id, "done")}
                    >
                      Erledigt
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className={autopilotGhostButtonFlexClassName}
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

      {!showSkeleton && aiReady ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Entwürfe</p>
            <p className="text-xs text-muted-foreground">
              Zwischengespeichert · speichern, posten oder planen — klar getrennt
              von Ideen im Generate-Sheet.
            </p>
          </div>

          {sortedSuggestions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
              Noch keine Entwürfe. Tippe „Neu generieren“, wähle Ideen, dann
              landen die Ergebnisse hier.
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
                            Entwurf
                          </MetaChip>
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
                          className={autopilotSecondaryButtonClassName}
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
                          className={autopilotPrimaryButtonClassName}
                          onClick={() => setActionsId(s.id)}
                        >
                          <Check className="size-4" />
                          Posten / Planen …
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={autopilotSecondaryButtonClassName}
                          onClick={() => setEditId(s.id)}
                        >
                          <Pencil className="size-4" />
                          Bearbeiten
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={autopilotSecondaryButtonClassName}
                          onClick={() => void saveAsTemplate(s.id)}
                        >
                          <Bookmark className="size-4" />
                          Als Design speichern
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className={autopilotGhostButtonClassName}
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

          {savedTemplates.length > 0 ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Gespeicherte Designs
                </p>
                <p className="text-xs text-muted-foreground">
                  Dauerhaft gemerkt — tippen öffnet wieder als Entwurf.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {savedTemplates.map((s) => (
                  <button
                    key={s.id}
                    type="button"
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
                        {s.title?.trim() || "Design"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Als Entwurf öffnen
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
              className={autopilotSecondaryButtonClassName}
              disabled={voiceBusy}
              onClick={() => void learnVoice()}
            >
              {voiceBusy ? "Lerne …" : "Stimme aus Social lernen"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={autopilotSecondaryButtonClassName}
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
                  className={autopilotPrimaryButtonClassName}
                  disabled={voiceBusy}
                  onClick={() => void confirmVoiceDraft()}
                >
                  In Social-Marke übernehmen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={autopilotGhostButtonClassName}
                  onClick={() => setVoiceDraft(null)}
                >
                  Verwerfen
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <SocialAutopilotGenerateDrawer
        open={generateOpen && aiReady}
        onOpenChange={setGenerateOpen}
        restaurantId={restaurantId}
        aiConfigured={aiConfigured}
        aiLabel={aiLabel}
        initialTone={sessionTone}
        initialPlatforms={sessionPlatforms}
        initialFormat={sessionFormat}
        onCreated={refreshDraftsAfterGenerate}
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
            <DrawerTitle>Entwurf bearbeiten</DrawerTitle>
            <DrawerDescription>
              Bild, Layout, Titel und Caption anpassen — bleibt zwischengespeichert.
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
              className={autopilotPrimaryButtonClassName}
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
              Design speichern bleibt parallel möglich.
            </DrawerDescription>
          </DrawerHeader>
          {acting ? (
            <div className="flex flex-col gap-2 px-6 pb-2">
              <Button
                type="button"
                className={autopilotPrimaryButtonClassName}
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
                className={autopilotSecondaryButtonClassName}
                disabled={busyId === acting.id}
                onClick={() => void approve(acting.id, false)}
              >
                Planen
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={autopilotGhostButtonClassName}
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
