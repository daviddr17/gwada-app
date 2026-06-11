"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

type WahaChannelOption = { id: string; name: string };
type NewsSettings = {
  whatsapp_channel_ids: string[];
  default_embed_view: "grid" | "list";
  embed_max_items: number;
};

export function NewsSettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<WahaChannelOption[]>([]);
  const [settings, setSettings] = useState<NewsSettings>({
    whatsapp_channel_ids: [],
    default_embed_view: "grid",
    embed_max_items: 24,
  });
  const [channelsOpen, setChannelsOpen] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [settingsRes, channelsRes] = await Promise.all([
        fetch(`/api/news/settings?restaurantId=${encodeURIComponent(restaurantId)}`),
        fetch(
          `/api/news/whatsapp-channels?restaurantId=${encodeURIComponent(restaurantId)}`,
        ),
      ]);
      const settingsData = (await settingsRes.json()) as {
        settings?: NewsSettings;
        error?: string;
      };
      const channelsData = (await channelsRes.json()) as {
        channels?: WahaChannelOption[];
      };
      if (settingsRes.ok && settingsData.settings) {
        setSettings(settingsData.settings);
      }
      setChannels(channelsData.channels ?? []);
    } catch {
      toast.error("Einstellungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const channelLabelById = useMemo(
    () => new Map(channels.map((channel) => [channel.id, channel.name || channel.id])),
    [channels],
  );

  const whatsappSelectionLabel = useMemo(() => {
    if (settings.whatsapp_channel_ids.length === 0) {
      return "Alle OWNER-Kanäle automatisch";
    }
    if (settings.whatsapp_channel_ids.length === 1) {
      const id = settings.whatsapp_channel_ids[0]!;
      return channelLabelById.get(id) ?? id;
    }
    return `${settings.whatsapp_channel_ids.length} Kanäle ausgewählt`;
  }, [channelLabelById, settings.whatsapp_channel_ids]);

  const save = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/news/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          whatsappChannelIds: settings.whatsapp_channel_ids,
          defaultEmbedView: settings.default_embed_view,
          embedMaxItems: settings.embed_max_items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save_failed");
      toast.success("Einstellungen gespeichert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const toggleWhatsappChannel = (channelId: string, checked: boolean) => {
    setSettings((prev) => {
      const next = new Set(prev.whatsapp_channel_ids);
      if (checked) next.add(channelId);
      else next.delete(channelId);
      return { ...prev, whatsapp_channel_ids: [...next] };
    });
  };

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (loading && showSkeleton) {
    return <div className="min-h-40 rounded-xl border border-border/50 bg-muted/20" aria-busy />;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <div className="space-y-2">
          <Label>WhatsApp Kanäle</Label>
          <Popover open={channelsOpen} onOpenChange={setChannelsOpen}>
            <PopoverTrigger
              type="button"
              className={appSelectTriggerAccentCn(
                "inline-flex h-10 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-normal",
              )}
            >
              <span className="truncate">{whatsappSelectionLabel}</span>
              <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
            </PopoverTrigger>
            <PopoverPortal>
              <PopoverPositioner align="start" side="bottom" sideOffset={8}>
                <PopoverContent className="w-80 p-2">
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {channels.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">
                    Keine OWNER-Kanäle gefunden. WhatsApp-Integration prüfen.
                  </p>
                ) : (
                  channels.map((channel) => {
                    const checked = settings.whatsapp_channel_ids.includes(channel.id);
                    return (
                      <label
                        key={channel.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleWhatsappChannel(channel.id, value === true)
                          }
                        />
                        <span className="min-w-0 truncate text-sm">
                          {channel.name || channel.id}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {settings.whatsapp_channel_ids.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 w-full rounded-lg text-muted-foreground"
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, whatsapp_channel_ids: [] }))
                  }
                >
                  Auswahl zurücksetzen (automatisch)
                </Button>
              ) : null}
                </PopoverContent>
              </PopoverPositioner>
            </PopoverPortal>
          </Popover>
          <p className="text-xs text-muted-foreground">
            OWNER-Kanäle für Lesen und Posten. Leer = alle OWNER-Kanäle automatisch.
            Posten nutzt den ersten ausgewählten Kanal.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Embed-Ansicht</Label>
          <Select
            value={settings.default_embed_view}
            onValueChange={(value) => {
              if (value === "grid" || value === "list") {
                setSettings((prev) => ({ ...prev, default_embed_view: value }));
              }
            }}
          >
            <SelectTrigger className={appSelectTriggerAccentCn("h-10 w-full rounded-xl")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grid">Raster (Pinterest)</SelectItem>
              <SelectItem value="list">Liste</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="embed-max-items">Max. Beiträge im Embed</Label>
          <Input
            id="embed-max-items"
            type="number"
            min={1}
            max={100}
            value={settings.embed_max_items}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                embed_max_items: Number.parseInt(e.target.value, 10) || 24,
              }))
            }
          />
        </div>

        <Button
          type="button"
          className={cn("h-11 rounded-xl", settingsAccentSaveButtonClassName)}
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Speichern …" : "Speichern"}
        </Button>
      </section>
    </div>
  );
}
