"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewsChannelInsightsList } from "@/components/news/news-channel-insights";
import { NewsPlatformChip } from "@/components/news/news-platform-filter-chips";
import {
  SocialAutopilotGenerateDrawer,
  type SocialKiComposeResult,
} from "@/components/social/social-autopilot-generate-drawer";
import {
  NEWS_FILTER_ALL,
  isNewsPlatform,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";
import type { NewsStoriesPlatform } from "@/lib/news/news-stories-cache-constants";
import type { NewsMediaRow } from "@/lib/news/news-media";
import { uploadNewsMedia } from "@/lib/news/news-media-api";
import { validateNewsMediaFile } from "@/lib/news/validate-news-media-file";
import { peekNewsFeedCache } from "@/lib/news/news-feed-client-cache";
import { computeNewsChannelInsights } from "@/lib/news/news-insights";
import type { NewsConnectorPublicInfo } from "@/lib/types/news-connectors";
import {
  defaultSocialBrandKit,
  type SocialBrandKit,
  type SocialTone,
} from "@/lib/social/social-brand-kit";
import type { SocialMediaFormatId } from "@/lib/social/social-media-formats";
import { cn } from "@/lib/utils";

type PendingMedia = NewsMediaRow & { previewUrl: string };

export type NewsComposeMode = "manual" | "ki";

export function NewsComposeDrawer({
  open,
  onOpenChange,
  restaurantId,
  connectors,
  onSaved,
  initialMode = "manual",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  connectors: NewsConnectorPublicInfo[];
  onSaved: () => void;
  initialMode?: NewsComposeMode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const postIdRef = useRef<string>("");

  const [mode, setMode] = useState<NewsComposeMode>(initialMode);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [platforms, setPlatforms] = useState<NewsPlatform[]>(["gwada"]);
  const [storyPlatforms, setStoryPlatforms] = useState<NewsStoriesPlatform[]>([]);
  const [media, setMedia] = useState<PendingMedia[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiLabel, setAiLabel] = useState("Restaurant-KI");
  const [sessionTone, setSessionTone] = useState<SocialTone>("warm");
  const [sessionPlatforms, setSessionPlatforms] = useState<NewsPlatform[]>([
    "instagram",
    "facebook",
  ]);
  const [sessionFormat, setSessionFormat] =
    useState<SocialMediaFormatId>("square_1x1");

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setTitle("");
    setBody("");
    setScheduleEnabled(false);
    setScheduledAt("");
    setPlatforms(["gwada"]);
    setStoryPlatforms([]);
    setMedia((prev) => {
      for (const item of prev) URL.revokeObjectURL(item.previewUrl);
      return [];
    });
    postIdRef.current = crypto.randomUUID();
    dragDepthRef.current = 0;
    setIsDragOver(false);
  }, [open, initialMode]);

  // KI-Tab: nur Brand-Kit Defaults — kein Ideas/LLM, kein schweres Media-Preload.
  useEffect(() => {
    if (!open || mode !== "ki") return;
    let cancelled = false;
    void (async () => {
      try {
        const kitRes = await fetch(
          `/api/social/brand-kit?restaurantId=${encodeURIComponent(restaurantId)}`,
        );
        const kitData = (await kitRes.json().catch(() => ({}))) as {
          kit?: SocialBrandKit;
        };
        if (cancelled) return;
        setAiConfigured(null);
        setAiLabel("Restaurant-KI");
        const kit = kitData.kit ?? defaultSocialBrandKit(restaurantId);
        setSessionTone(kit.tone);
        setSessionPlatforms(
          kit.publishPlatforms.length > 0
            ? [...kit.publishPlatforms]
            : ["instagram", "facebook"],
        );
      } catch {
        if (!cancelled) setAiConfigured(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, restaurantId]);

  const toggleStoryPlatform = (key: NewsStoriesPlatform) => {
    setStoryPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const storyEligibleConnectors = connectors.filter(
    (c) =>
      c.connected &&
      c.capabilities.canPublishStory &&
      (c.key === "instagram" || c.key === "facebook"),
  );

  const channelInsights = useMemo(() => {
    if (!open || mode !== "manual") return [];
    const cached = peekNewsFeedCache(restaurantId, NEWS_FILTER_ALL);
    const rows = computeNewsChannelInsights(cached?.items ?? []);
    const connected = new Set(
      connectors.filter((c) => c.connected || c.key === "gwada").map((c) => c.key),
    );
    return rows.filter(
      (row) =>
        connected.has(row.platform) &&
        row.platform !== "gwada" &&
        (row.reach != null || row.engagement != null || row.posts > 0),
    );
  }, [open, mode, restaurantId, connectors]);

  const effectiveScheduledAt = scheduleEnabled ? scheduledAt : "";
  const canPublishStories = media.length > 0 && !effectiveScheduledAt;

  const togglePlatform = (key: NewsPlatform) => {
    setPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const uploadFile = useCallback(
    async (file: File) => {
      const err = validateNewsMediaFile(file);
      if (err) {
        toast.error(err);
        return;
      }
      if (!postIdRef.current) postIdRef.current = crypto.randomUUID();
      setUploading(true);
      try {
        const result = await uploadNewsMedia({
          restaurantId,
          postId: postIdRef.current,
          file,
          sortOrder: media.length,
        });
        if ("error" in result) throw new Error(result.error);
        const previewUrl = URL.createObjectURL(file);
        setMedia((prev) => [...prev, { ...result.media, previewUrl }]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload fehlgeschlagen.");
      } finally {
        setUploading(false);
      }
    },
    [restaurantId, media.length],
  );

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((m) => m.id !== id);
    });
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      void (async () => {
        for (const file of files) {
          await uploadFile(file);
        }
      })();
    },
    [uploadFile],
  );

  const applyKiCompose = useCallback((payload: SocialKiComposeResult) => {
    setMedia((prev) => {
      for (const item of prev) URL.revokeObjectURL(item.previewUrl);
      return payload.media.map((m) => ({
        id: m.id,
        kind: m.kind,
        storagePath: m.storagePath,
        mimeType: m.mimeType,
        sortOrder: m.sortOrder,
        width: m.width ?? null,
        height: m.height ?? null,
        previewUrl: m.previewUrl,
      }));
    });
    setTitle(payload.title?.trim() || "");
    setBody(payload.body);
    const nextPlatforms = payload.platforms.filter(isNewsPlatform);
    setPlatforms(nextPlatforms.length > 0 ? nextPlatforms : ["gwada"]);
    setScheduleEnabled(false);
    setScheduledAt("");
    setStoryPlatforms([]);
    postIdRef.current = crypto.randomUUID();
    setMode("manual");
    toast.success("Post bereit — noch anpassen, dann veröffentlichen oder planen");
  }, []);

  const save = useCallback(
    async (opts?: { asDraft?: boolean }) => {
      if (!body.trim()) {
        toast.error("Bitte Text eingeben.");
        return;
      }
      const asDraft = opts?.asDraft === true;
      if (!asDraft && platforms.includes("instagram") && media.length === 0) {
        toast.error("Instagram benötigt mindestens ein Bild.");
        return;
      }
      if (!asDraft && scheduleEnabled && !scheduledAt.trim()) {
        toast.error("Bitte Zeitpunkt für die Planung wählen.");
        return;
      }
      if (!postIdRef.current) postIdRef.current = crypto.randomUUID();
      setSaving(true);
      try {
        const res = await fetch("/api/news/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            postId: postIdRef.current,
            title: title.trim() || null,
            body: body.trim(),
            scheduledAt:
              !asDraft && effectiveScheduledAt
                ? new Date(effectiveScheduledAt).toISOString()
                : null,
            platforms,
            storyPlatforms:
              !asDraft && canPublishStories ? storyPlatforms : [],
            media: media.map(({ previewUrl: _previewUrl, ...row }) => row),
            saveAsDraft: asDraft || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "save_failed");
        toast.success(
          asDraft
            ? "Als Entwurf gespeichert — später bearbeiten und veröffentlichen."
            : effectiveScheduledAt
              ? "News geplant."
              : "News veröffentlicht.",
        );
        onOpenChange(false);
        onSaved();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Speichern fehlgeschlagen.",
        );
      } finally {
        setSaving(false);
      }
    },
    [
      body,
      title,
      scheduleEnabled,
      scheduledAt,
      effectiveScheduledAt,
      platforms,
      storyPlatforms,
      canPublishStories,
      media,
      restaurantId,
      onOpenChange,
      onSaved,
    ],
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent
        className={drawerContentClassName(mode === "ki" ? "mediaTall" : "form")}
      >
        <DrawerHeader className="space-y-3 px-4 text-left sm:px-6">
          <DrawerTitle className="text-left">Neue News</DrawerTitle>
          <Tabs
            value={mode}
            onValueChange={(v) => {
              if (v === "manual" || v === "ki") setMode(v);
            }}
            className="w-full gap-0"
          >
            <TabsList
              className={cn(
                "mx-auto grid h-11 w-full max-w-md grid-cols-2 self-stretch rounded-xl p-1",
              )}
            >
              <TabsTrigger value="manual" className="rounded-lg px-2">
                Eigener Post
              </TabsTrigger>
              <TabsTrigger value="ki" className="rounded-lg px-2">
                KI-Post
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DrawerHeader>

        {mode === "ki" ? (
          <div className="flex min-h-0 flex-1 flex-col px-6 pb-2">
            <SocialAutopilotGenerateDrawer
              embedded
              forCompose
              open={open && mode === "ki"}
              onOpenChange={onOpenChange}
              restaurantId={restaurantId}
              aiConfigured={aiConfigured}
              aiLabel={aiLabel}
              initialTone={sessionTone}
              initialPlatforms={sessionPlatforms}
              initialFormat={sessionFormat}
              onComposeReady={applyKiCompose}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className={drawerScrollAreaClassName(4)}>
              <DrawerFormSection contentPadding={4} title="Inhalt">
                <Input
                  placeholder="Titel (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Text"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                />
              </DrawerFormSection>

              <DrawerFormSection contentPadding={4} title="Medien">
                <div className="space-y-2">
                  <Label id="news-media-label">Bild oder Video</Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadFile(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    aria-labelledby="news-media-label"
                    data-vaul-no-drag
                    onClick={() => fileRef.current?.click()}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                      isDragOver
                        ? "border-accent bg-accent/10"
                        : "border-border/60 bg-muted/20 hover:border-border",
                    )}
                  >
                    <Upload className="size-8 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Datei wählen oder hierher ziehen
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Bild oder Video, max. 100 MB
                    </span>
                  </button>
                  {uploading ? (
                    <p className="text-xs text-muted-foreground">Wird hochgeladen …</p>
                  ) : null}
                  {media.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {media.map((item) => (
                        <div
                          key={item.id}
                          className="relative overflow-hidden rounded-lg border border-border/50 bg-muted/20"
                        >
                          {item.kind === "video" ? (
                            <video
                              src={item.previewUrl}
                              className="aspect-video w-full object-cover"
                              muted
                              playsInline
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.previewUrl}
                              alt=""
                              className="aspect-video w-full object-cover"
                            />
                          )}
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="secondary"
                            className="absolute top-1 right-1 rounded-full"
                            onClick={() => removeMedia(item.id)}
                            aria-label="Entfernen"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </DrawerFormSection>

              <DrawerFormSection contentPadding={4} title="Planen">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="news-compose-schedule" className="text-sm font-normal">
                    Später veröffentlichen
                  </Label>
                  <Switch
                    id="news-compose-schedule"
                    size="sm"
                    checked={scheduleEnabled}
                    onCheckedChange={(checked) => {
                      const enabled = checked === true;
                      setScheduleEnabled(enabled);
                      if (!enabled) setScheduledAt("");
                    }}
                  />
                </div>
                {scheduleEnabled ? (
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    aria-label="Veröffentlichungszeitpunkt"
                  />
                ) : null}
              </DrawerFormSection>

              <DrawerFormSection contentPadding={4} title="Plattformen">
                <div className="flex flex-wrap gap-2">
                  {connectors.map((c) => {
                    const disabled = c.key !== "gwada" && !c.connected;
                    const selected = platforms.includes(c.key);
                    return (
                      <NewsPlatformChip
                        key={c.key}
                        platform={c.key}
                        selected={selected}
                        disabled={disabled || !c.capabilities.canCreatePost}
                        onSelect={() => togglePlatform(c.key)}
                      />
                    );
                  })}
                </div>
                {channelInsights.length > 0 ? (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Reichweite &amp; Engagement je Kanal (aus dem News-Feed)
                    </p>
                    <NewsChannelInsightsList
                      channels={channelInsights}
                      compact
                    />
                  </div>
                ) : null}
              </DrawerFormSection>
              {storyEligibleConnectors.length > 0 ? (
                <DrawerFormSection contentPadding={4} title="Zusätzlich als Story">
                  <div className="flex flex-wrap gap-2">
                    {storyEligibleConnectors.map((c) => {
                      const selected = storyPlatforms.includes(
                        c.key as NewsStoriesPlatform,
                      );
                      return (
                        <NewsPlatformChip
                          key={`story-${c.key}`}
                          platform={c.key}
                          selected={selected}
                          disabled={!canPublishStories}
                          onSelect={() =>
                            toggleStoryPlatform(c.key as NewsStoriesPlatform)
                          }
                        />
                      );
                    })}
                  </div>
                  {!canPublishStories ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Story erfordert Medien und ist nicht mit Planung kombinierbar.
                    </p>
                  ) : null}
                </DrawerFormSection>
              ) : null}
            </div>
            <DrawerFooter className="border-t border-border/50 pt-2 shrink-0">
              <div className="flex w-full flex-col gap-3">
                <DrawerFormFooter
                  onCancel={() => onOpenChange(false)}
                  cancelDisabled={saving || uploading}
                  submitLabel={
                    effectiveScheduledAt ? "Planen" : "Veröffentlichen"
                  }
                  submitPending={saving}
                  submitDisabled={uploading}
                  submitType="button"
                  onSubmit={() => void save()}
                  className="border-0 px-0 pt-0 pb-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-xl"
                  disabled={saving || uploading}
                  onClick={() => void save({ asDraft: true })}
                >
                  Als Entwurf speichern
                </Button>
              </div>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
