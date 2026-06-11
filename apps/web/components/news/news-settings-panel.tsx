"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  whatsapp_channel_id: string | null;
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
    whatsapp_channel_id: null,
    default_embed_view: "grid",
    embed_max_items: 24,
  });

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

  const save = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/news/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          whatsappChannelId: settings.whatsapp_channel_id,
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

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (loading && showSkeleton) {
    return <div className="min-h-40 rounded-xl border border-border/50 bg-muted/20" aria-busy />;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <div className="space-y-2">
          <Label>WhatsApp Kanal</Label>
          <Select
            value={settings.whatsapp_channel_id ?? "__none__"}
            onValueChange={(value) => {
              if (typeof value !== "string") return;
              setSettings((prev) => ({
                ...prev,
                whatsapp_channel_id: value === "__none__" ? null : value,
              }));
            }}
          >
            <SelectTrigger className={appSelectTriggerAccentCn("h-10 w-full rounded-xl")}>
              <SelectValue placeholder="Kanal wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Ersten OWNER-Kanal automatisch</SelectItem>
              {channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name || channel.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Kanal für Lesen und Posten über WAHA. WhatsApp-Integration muss verbunden sein.
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
