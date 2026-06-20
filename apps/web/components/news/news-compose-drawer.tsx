"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { NewsPlatformChip } from "@/components/news/news-platform-filter-chips";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import type { NewsStoriesPlatform } from "@/lib/news/news-stories-cache-constants";
import type { NewsMediaRow } from "@/lib/news/news-media";
import { uploadNewsMedia } from "@/lib/news/news-media-api";
import { validateNewsMediaFile } from "@/lib/news/validate-news-media-file";
import type { NewsConnectorPublicInfo } from "@/lib/types/news-connectors";
import { cn } from "@/lib/utils";

type PendingMedia = NewsMediaRow & { previewUrl: string };

export function NewsComposeDrawer({
  open,
  onOpenChange,
  restaurantId,
  connectors,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  connectors: NewsConnectorPublicInfo[];
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const postIdRef = useRef<string>("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [platforms, setPlatforms] = useState<NewsPlatform[]>(["gwada"]);
  const [storyPlatforms, setStoryPlatforms] = useState<NewsStoriesPlatform[]>([]);
  const [media, setMedia] = useState<PendingMedia[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody("");
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
  }, [open]);

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

  const canPublishStories = media.length > 0 && !scheduledAt;

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

  const save = useCallback(async () => {
    if (!body.trim()) {
      toast.error("Bitte Text eingeben.");
      return;
    }
    if (platforms.includes("instagram") && media.length === 0) {
      toast.error("Instagram benötigt mindestens ein Bild.");
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
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          platforms,
          storyPlatforms: canPublishStories ? storyPlatforms : [],
          media: media.map(({ previewUrl: _previewUrl, ...row }) => row),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save_failed");
      toast.success(scheduledAt ? "News geplant." : "News veröffentlicht.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }, [
    body,
    title,
    scheduledAt,
    platforms,
    storyPlatforms,
    canPublishStories,
    media,
    restaurantId,
    onOpenChange,
    onSaved,
  ]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("form")}>
        <DrawerHeader>
          <DrawerTitle>Neue News</DrawerTitle>
        </DrawerHeader>
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
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
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
          </DrawerFormSection>
          {storyEligibleConnectors.length > 0 ? (
            <DrawerFormSection contentPadding={4} title="Zusätzlich als Story">
              <div className="flex flex-wrap gap-2">
                {storyEligibleConnectors.map((c) => {
                  const selected = storyPlatforms.includes(c.key as NewsStoriesPlatform);
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
          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            cancelDisabled={saving || uploading}
            submitLabel={scheduledAt ? "Planen" : "Veröffentlichen"}
            submitPending={saving}
            submitDisabled={uploading}
            submitType="button"
            onSubmit={() => void save()}
          />
        </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
