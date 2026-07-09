"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { ShareChannelPicker } from "@/components/share/share-channel-chips";
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
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import type { ShareSourceType } from "@/lib/constants/share-channels";
import { SHARE_SOURCE_TYPE_LABELS } from "@/lib/constants/share-channels";
import type { ShareContentPayload } from "@/lib/share/share-types";
import { useShareChannelsStatus } from "@/lib/hooks/use-share-channels-status";

function sharePublishErrorMessage(error: string): string {
  switch (error) {
    case "body_required":
      return "Bitte Text eingeben.";
    case "no_channels_selected":
      return "Bitte mindestens einen Kanal wählen.";
    case "image_required":
      return "Für diesen Kanal wird ein Bild benötigt.";
    case "instagram_requires_image":
      return "Instagram benötigt mindestens ein Bild.";
    case "channel_not_connected":
      return "Kanal ist nicht verbunden.";
    case "facebook_not_connected":
    case "instagram_not_connected":
    case "google_not_connected":
      return "Kanal ist nicht verbunden — bitte in den Einstellungen prüfen.";
    default:
      return "Veröffentlichen fehlgeschlagen.";
  }
}

export function ShareToChannelsSheet({
  open,
  onOpenChange,
  restaurantId,
  sourceType,
  payload,
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  sourceType: ShareSourceType;
  payload: ShareContentPayload;
  onPublished?: () => void;
}) {
  const { channels, connectedChannels, hasConnectedChannel, loading } =
    useShareChannelsStatus(restaurantId, sourceType);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);

  const imageUrls = payload.imageUrls ?? [];
  const hasImage = imageUrls.length > 0;

  useEffect(() => {
    if (!open) return;
    setTitle(payload.title?.trim() ?? "");
    setBody(payload.body.trim());
    setSelected(new Set());
    setPublishing(false);
  }, [open, payload.title, payload.body]);

  const selectableChannels = useMemo(
    () =>
      connectedChannels.filter(
        (c) => !c.requiresImage || hasImage,
      ),
    [connectedChannels, hasImage],
  );

  const toggleChannel = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const publish = useCallback(async () => {
    if (!body.trim()) {
      toast.error("Bitte Text eingeben.");
      return;
    }
    if (selected.size === 0) {
      toast.error("Bitte mindestens einen Kanal wählen.");
      return;
    }

    for (const key of selected) {
      const channel = channels.find((c) => c.key === key);
      if (channel?.requiresImage && !hasImage) {
        toast.error(`${channel.label} benötigt ein Bild.`);
        return;
      }
    }

    setPublishing(true);
    try {
      const res = await fetch("/api/share/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          sourceType,
          title: title.trim() || null,
          body: body.trim(),
          imageUrls,
          link: payload.link ?? null,
          channels: [...selected],
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        publishedCount?: number;
        failedCount?: number;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "publish_failed");
      }
      const published = data.publishedCount ?? 0;
      const failed = data.failedCount ?? 0;
      if (published > 0 && failed === 0) {
        toast.success(
          published === 1
            ? "Auf Kanal veröffentlicht."
            : `Auf ${published} Kanäle veröffentlicht.`,
        );
      } else if (published > 0) {
        toast.success(`${published} Kanal(e) ok, ${failed} fehlgeschlagen.`);
      } else {
        toast.error("Veröffentlichen fehlgeschlagen.");
      }
      onOpenChange(false);
      onPublished?.();
    } catch (e) {
      const msg =
        e instanceof Error
          ? sharePublishErrorMessage(e.message)
          : "Veröffentlichen fehlgeschlagen.";
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  }, [
    body,
    channels,
    hasImage,
    imageUrls,
    onOpenChange,
    onPublished,
    payload.link,
    restaurantId,
    selected,
    sourceType,
    title,
  ]);

  const sourceLabel = SHARE_SOURCE_TYPE_LABELS[sourceType];

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("form")}>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Share2 className="size-5 shrink-0" aria-hidden />
            Teilen auf verbundene Kanäle
          </DrawerTitle>
          <p className="text-sm text-muted-foreground">
            {sourceLabel} auf Google, Facebook oder Instagram veröffentlichen.
          </p>
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(4)}>
          {hasImage ? (
            <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrls[0]}
                alt=""
                className="max-h-48 w-full object-contain"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="share-title">Titel (optional)</Label>
            <Input
              id="share-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-body">Text</Label>
            <Textarea
              id="share-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Kanäle</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Kanäle werden geladen …</p>
            ) : (
              <ShareChannelPicker
                channels={channels}
                selected={selected}
                onToggle={toggleChannel}
                disabled={publishing}
              />
            )}
            {!loading && !hasImage ? (
              <p className="text-xs text-muted-foreground">
                Instagram Beiträge und Stories benötigen ein Bild — ohne Bild nur
                Google und Facebook Beiträge verfügbar.
              </p>
            ) : null}
          </div>
        </div>

        <DrawerFooter>
          <DrawerFormFooter
            contentPadding={4}
            onCancel={() => onOpenChange(false)}
            cancelDisabled={publishing}
            submitLabel="Jetzt veröffentlichen"
            submitPending={publishing}
            submitType="button"
            onSubmit={() => void publish()}
            submitDisabled={
              loading || !hasConnectedChannel || selectableChannels.length === 0
            }
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function ShareToChannelsTriggerButton({
  onClick,
  disabled,
  className,
  size = "sm",
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      <Share2 className="size-4" />
      Teilen
    </Button>
  );
}
