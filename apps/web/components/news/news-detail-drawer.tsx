"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { NewsInsightsBadges } from "@/components/news/news-insights-badges";
import { NewsPlatformIcon } from "@/components/news/news-platform-icon";
import {
  NEWS_PLATFORM_LABELS,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import type { NewsConnectorPublicInfo } from "@/lib/types/news-connectors";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<UnifiedNewsItem["status"], string> = {
  draft: "Entwurf",
  scheduled: "Geplant",
  published: "Veröffentlicht",
  failed: "Fehlgeschlagen",
  archived: "Archiviert",
};

import { formatNewsCardDate, formatNewsDetailDate, newsDisplayTimestamp } from "@/lib/news/format-news-display-date";

function platformOpenUrl(
  item: UnifiedNewsItem,
  connectors: NewsConnectorPublicInfo[],
): string | null {
  if (item.externalUrl?.trim()) return item.externalUrl;
  const externalId = item.id.includes(":") ? item.id.split(":").slice(1).join(":") : null;
  const connector = connectors.find((c) => c.key === item.platform);
  if (!connector?.externalEditBaseUrl) return null;
  if (item.platform === "facebook" && externalId) {
    return `https://www.facebook.com/${externalId}`;
  }
  return connector.externalEditBaseUrl;
}

export function NewsDetailDrawer({
  open,
  onOpenChange,
  item,
  restaurantId,
  canManage,
  connectors,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: UnifiedNewsItem | null;
  restaurantId: string;
  canManage: boolean;
  connectors: NewsConnectorPublicInfo[];
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isGwadaEditable =
    canManage &&
    item?.source === "gwada" &&
    Boolean(item.postId) &&
    item.status !== "archived";

  useEffect(() => {
    if (!open || !item) return;
    setTitle(item.title ?? "");
    setBody(item.body);
  }, [open, item]);

  const externalUrl = useMemo(
    () => (item ? platformOpenUrl(item, connectors) : null),
    [item, connectors],
  );

  const save = useCallback(async () => {
    if (!item?.postId || !body.trim()) {
      toast.error("Bitte Text eingeben.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/news/posts/${item.postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          title: title.trim() || null,
          body: body.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save_failed");
      toast.success("News gespeichert.");
      onOpenChange(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }, [item, body, title, restaurantId, onOpenChange, onChanged]);

  const remove = useCallback(async () => {
    if (!item?.postId) return;
    if (!window.confirm("News wirklich archivieren?")) return;
    setDeleting(true);
    try {
      const qs = new URLSearchParams({ restaurantId });
      const res = await fetch(`/api/news/posts/${item.postId}?${qs}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "delete_failed");
      toast.success("News archiviert.");
      onOpenChange(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    } finally {
      setDeleting(false);
    }
  }, [item, restaurantId, onOpenChange, onChanged]);

  if (!item) return null;

  const preview = item.media[0];
  const platform = item.platform as NewsPlatform;
  const pending = saving || deleting;
  const publishedLabel =
    item.status === "scheduled" && item.scheduledAt
      ? `Geplant · ${formatNewsDetailDate(item.scheduledAt)}`
      : formatNewsDetailDate(newsDisplayTimestamp(item));

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="mx-auto max-h-[min(92dvh,720px)] max-w-lg rounded-t-[1.75rem]">
        <DrawerHeader className="text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <NewsPlatformIcon platform={platform} className="size-3" />
              {NEWS_PLATFORM_LABELS[platform]}
            </Badge>
            <Badge variant="outline">{STATUS_LABELS[item.status]}</Badge>
          </div>
          <DrawerTitle className="pt-1">
            {item.title?.trim() || "News-Beitrag"}
          </DrawerTitle>
          <p className="text-sm text-muted-foreground">{publishedLabel}</p>
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto overscroll-contain px-4 pt-2 pb-2">
          {preview?.url ? (
            <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/20">
              {preview.kind === "video" ? (
                <video
                  src={preview.url}
                  className="max-h-64 w-full object-cover"
                  controls
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt="" className="max-h-64 w-full object-cover" />
              )}
            </div>
          ) : null}

          {isGwadaEditable ? (
            <>
              <Input
                placeholder="Titel (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
              />
            </>
          ) : (
            <>
              {item.title ? (
                <p className="font-medium leading-snug">{item.title}</p>
              ) : null}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {item.body}
              </p>
            </>
          )}

          {item.insights ? (
            <NewsInsightsBadges insights={item.insights} className="text-sm" />
          ) : null}

          {externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted",
              )}
            >
              <ExternalLink className="size-4" />
              Auf {NEWS_PLATFORM_LABELS[platform]} öffnen
            </a>
          ) : item.source === "external" && !item.canEdit ? (
            <p className="text-xs text-muted-foreground">
              Bearbeiten ist nur direkt auf {NEWS_PLATFORM_LABELS[platform]} möglich.
            </p>
          ) : null}
        </div>

        {isGwadaEditable ? (
          <DrawerFooter className="border-t border-border/50 pt-2">
            <DrawerFormFooter
              onCancel={() => onOpenChange(false)}
              cancelDisabled={pending}
              submitLabel="Speichern"
              submitPending={saving}
              submitDisabled={deleting}
              submitType="button"
              onSubmit={() => void save()}
              showDelete
              deleteLabel="Archivieren"
              deleteDisabled={pending}
              onDelete={() => void remove()}
            />
          </DrawerFooter>
        ) : (
          <DrawerFooter className="border-t border-border/50 pt-2">
            <Button
              type="button"
              variant="outline"
              className={cn("h-12 w-full rounded-xl")}
              onClick={() => onOpenChange(false)}
            >
              Schließen
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
