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
import { Check, Pencil, RefreshCw, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { SocialTemplatePreview } from "@/components/social/social-template-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  SOCIAL_FEED_LAYOUT_CHIP_LABELS,
  SOCIAL_SLOT_KIND_LABELS,
  type SocialMediaTask,
  type SocialPostSuggestion,
  type SocialSuggestionAsset,
} from "@/lib/social/social-suggestion-types";
import type { SocialBrandKit } from "@/lib/social/social-brand-kit";
import {
  DEFAULT_SOCIAL_FEED_PALETTE,
  SOCIAL_FEED_LAYOUT_IDS,
  SOCIAL_PHOTO_LOOK_LABELS,
  type SocialFeedLayoutId,
} from "@/lib/social/social-feed-brand-system";
import { defaultSocialBrandKit } from "@/lib/social/social-brand-kit";
import { resolveSuggestionFeedLayout } from "@/lib/social/social-feed-layout";
import { socialPublishPlatformLabel } from "@/lib/social/social-publish-platforms";
import { isNewsPlatform } from "@/lib/constants/news-platforms";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { cn } from "@/lib/utils";

type AssetOption = SocialSuggestionAsset & {
  id: string;
  group: "gallery" | "menu" | "profile" | "event";
  label: string;
};

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

const GROUP_LABELS: Record<AssetOption["group"], string> = {
  gallery: "Galerie",
  menu: "Speisekarte",
  profile: "Profil",
  event: "Events",
};

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

export function SocialAutopilotScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { profile } = useRestaurantProfile();
  const [suggestions, setSuggestions] = useState<SocialPostSuggestion[]>([]);
  const [tasks, setTasks] = useState<SocialMediaTask[]>([]);
  const [kit, setKit] = useState<SocialBrandKit | null>(null);
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      if (!restaurantId) return;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ restaurantId });
        if (opts?.refresh) qs.set("refresh", "1");
        const [sugRes, kitRes, optRes] = await Promise.all([
          fetch(`/api/social/suggestions?${qs}`),
          fetch(
            `/api/social/brand-kit?restaurantId=${encodeURIComponent(restaurantId)}`,
          ),
          fetch(
            `/api/social/asset-options?restaurantId=${encodeURIComponent(restaurantId)}`,
          ),
        ]);
        const sugData = (await sugRes.json().catch(() => ({}))) as {
          suggestions?: SocialPostSuggestion[];
          tasks?: SocialMediaTask[];
          generation?: {
            created?: number;
            skippedReason?: string;
          };
        };
        const kitData = (await kitRes.json().catch(() => ({}))) as {
          kit?: SocialBrandKit;
        };
        const optData = (await optRes.json().catch(() => ({}))) as {
          options?: AssetOption[];
        };
        if (!sugRes.ok) {
          toast.error("Vorschläge konnten nicht geladen werden");
          return;
        }
        const list = sugData.suggestions ?? [];
        const open = list.filter(
          (s) => s.status === "pending" || s.status === "needs_asset",
        );
        setSuggestions(open);
        setTasks(sugData.tasks ?? []);
        setKit(kitData.kit ?? defaultSocialBrandKit(restaurantId));
        setAssetOptions(optData.options ?? []);

        const nextTitles: Record<string, string> = {};
        const nextCaptions: Record<string, string> = {};
        for (const s of list) {
          nextTitles[s.id] = s.title?.trim() ?? "";
          nextCaptions[s.id] = s.caption;
        }
        if (opts?.refresh) {
          setDraftTitles(nextTitles);
          setDraftCaptions(nextCaptions);
          setEditId(null);
          setActionsId(null);
          const gen = sugData.generation;
          if (gen?.skippedReason === "disabled") {
            toast.error("Autopilot ist in der Social-Marke ausgeschaltet");
          } else if ((gen?.created ?? 0) > 0) {
            toast.success(
              `${gen!.created} neue Vorschläge mit Galerie & Speisekarte`,
            );
          } else {
            toast.message("Keine neuen Vorschläge erzeugt");
          }
        } else {
          setDraftTitles((prev) => {
            const next = { ...prev };
            for (const s of list) {
              if (next[s.id] == null) next[s.id] = nextTitles[s.id] ?? "";
            }
            return next;
          });
          setDraftCaptions((prev) => {
            const next = { ...prev };
            for (const s of list) {
              if (next[s.id] == null) next[s.id] = nextCaptions[s.id] ?? "";
            }
            return next;
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [restaurantId],
  );

  useEffect(() => {
    if (!ready || !restaurantId) return;
    void load();
  }, [ready, restaurantId, load]);

  const patchSuggestion = useCallback(
    async (
      id: string,
      patch: {
        title?: string | null;
        caption?: string;
        asset?: SocialSuggestionAsset;
        feedLayout?: SocialFeedLayoutId;
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
        error?: string;
      };
      if (!res.ok || !data.suggestion) {
        toast.error("Änderung konnte nicht gespeichert werden");
        return;
      }
      setSuggestions((prev) =>
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
        toast.error("Überspringen fehlgeschlagen");
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

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  const restaurantName = profile?.name?.trim() || "Restaurant";
  const feedPalette = kit?.feedPalette ?? DEFAULT_SOCIAL_FEED_PALETTE;
  const photoLook = kit?.photoLook ?? "warm";
  const publishStories = kit?.publishStories !== false;
  const ctaLabel = kit?.cta ?? "Tisch reservieren";
  const logoUrl =
    assetOptions.find((o) => o.id === "profile:avatar")?.imageUrl ?? null;

  const editing = editId
    ? suggestions.find((s) => s.id === editId) ?? null
    : null;
  const acting = actionsId
    ? suggestions.find((s) => s.id === actionsId) ?? null
    : null;

  const galleryCount = assetOptions.filter((o) => o.group === "gallery").length;
  const menuCount = assetOptions.filter((o) => o.group === "menu").length;

  return (
    <div className="space-y-6 pb-4">
      <Button
        type="button"
        size="lg"
        className={modulePrimaryAddButtonFullWidthClassName}
        onClick={() => void load({ refresh: true })}
        disabled={loading}
      >
        <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        Neu vorschlagen
      </Button>

      {kit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/25 px-3 py-2.5">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm text-muted-foreground">
              Social-Marke · {SOCIAL_PHOTO_LOOK_LABELS[photoLook]}
              {preferredLayouts.length > 0
                ? ` · ${preferredLayouts.length} Layouts`
                : null}
            </p>
            <p className="text-xs text-muted-foreground/90">
              Bildquellen: {galleryCount} Galerie · {menuCount} Speisekarte
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-border/60"
            render={<Link href={APP_ROUTES.settings.restaurant} />}
          >
            Anpassen
          </Button>
        </div>
      ) : null}

      {tasks.length > 0 ? (
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
                    className={cn(
                      "w-full",
                      brandActionButtonRoundedClassName,
                    )}
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

      {showSkeleton ? (
        <div className="space-y-4" aria-busy>
          {[0, 1].map((i) => (
            <SkeletonCardFrame key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full max-w-md rounded-xl" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
            </SkeletonCardFrame>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Keine offenen Vorschläge. „Neu vorschlagen“ mischt Galerie- und
          Speisekarten-Bilder — oder warte auf den nächsten Wochenlauf.
        </p>
      ) : (
        <div className="space-y-5">
          {suggestions.map((s) => {
            const title = draftTitles[s.id] ?? s.title?.trim() ?? "";
            const caption = draftCaptions[s.id] ?? s.caption;
            const layout = layoutForSuggestion(s);
            const sourceLabel =
              s.asset.source === "gallery"
                ? "Galerie"
                : s.asset.source === "menu"
                  ? "Speisekarte"
                  : s.asset.source === "event"
                    ? "Event"
                    : s.asset.source === "profile"
                      ? "Profil"
                      : "Ohne Bild";
            return (
              <Card
                key={s.id}
                className="overflow-hidden border-border/50 shadow-card"
              >
                <CardContent className="space-y-4 pt-5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <MetaChip>{SOCIAL_SLOT_KIND_LABELS[s.slotKind]}</MetaChip>
                    <MetaChip>{sourceLabel}</MetaChip>
                    <MetaChip>{SOCIAL_FEED_LAYOUT_CHIP_LABELS[layout]}</MetaChip>
                    {s.platforms.filter(isNewsPlatform).map((p) => (
                      <MetaChip key={p}>
                        {socialPublishPlatformLabel(p)}
                      </MetaChip>
                    ))}
                    {publishStories &&
                    (s.platforms.includes("facebook") ||
                      s.platforms.includes("instagram")) ? (
                      <MetaChip>+ Story</MetaChip>
                    ) : null}
                    <MetaChip>{formatPlan(s.plannedAt)}</MetaChip>
                    {s.status === "needs_asset" ? (
                      <MetaChip className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
                        Bild fehlt
                      </MetaChip>
                    ) : null}
                  </div>

                  <div className="mx-auto w-full max-w-md">
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
                    />
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
                      Freigeben …
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
                      variant="ghost"
                      className="h-11 w-full rounded-xl text-muted-foreground"
                      disabled={busyId === s.id}
                      onClick={() => void skip(s.id)}
                    >
                      <SkipForward className="size-4" />
                      Überspringen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
              Bild aus Galerie oder Speisekarte, Layout, Titel und Caption.
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
                                    "relative aspect-square overflow-hidden rounded-xl border transition-colors",
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
                  {assetOptions.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                      Keine Bilder in Galerie oder Speisekarte. Lade Fotos in der
                      Galerie hoch, dann „Neu vorschlagen“.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Layout</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {preferredLayouts.map((layoutId) => {
                      const active =
                        layoutForSuggestion(editing) === layoutId;
                      return (
                        <button
                          key={layoutId}
                          type="button"
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            active
                              ? "border-accent/50 bg-accent/15 text-foreground"
                              : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                          )}
                          aria-pressed={active}
                          disabled={busyId === editing.id}
                          onClick={() =>
                            void patchSuggestion(editing.id, {
                              feedLayout: layoutId,
                            })
                          }
                        >
                          {SOCIAL_FEED_LAYOUT_CHIP_LABELS[layoutId]}
                        </button>
                      );
                    })}
                  </div>
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
            <DrawerTitle>Freigeben</DrawerTitle>
            <DrawerDescription>
              Sofort posten oder zum geplanten Zeitpunkt freigeben.
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
                Freigeben & posten
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-xl"
                disabled={busyId === acting.id}
                onClick={() => void approve(acting.id, false)}
              >
                Freigeben (planen)
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
