"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmbedProfilePlatformToggles } from "@/components/embed/embed-profile-platform-toggles";
import { EventsPlatformIcon } from "@/components/events/events-platform-icon";
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
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import {
  EVENTS_NATIVE_PLATFORMS,
  EVENTS_PLATFORM_LABELS,
} from "@/lib/constants/events-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useEventsPlatformConnections } from "@/lib/hooks/use-events-platform-connections";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  defaultEventsEmbedPlatforms,
  type EventsEmbedPlatforms,
} from "@/lib/events/events-embed-platforms";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  publicSurfaceProfileAndEmbedDescription,
  publicSurfaceProfileAndEmbedTitle,
} from "@/lib/ui/public-surface-settings-copy";

type EventsSettings = {
  whatsapp_channel_ids: string[];
  default_embed_view: "grid" | "list";
  embed_max_items: number;
  embed_platforms: EventsEmbedPlatforms;
  embed_show_all_filter: boolean;
};

function defaultSettings(): EventsSettings {
  return {
    whatsapp_channel_ids: [],
    default_embed_view: "list",
    embed_max_items: 24,
    embed_platforms: defaultEventsEmbedPlatforms(),
    embed_show_all_filter: true,
  };
}

export function EventsSettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { connectors, loading: connectorsLoading } =
    useEventsPlatformConnections(restaurantId);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<EventsSettings>(defaultSettings);
  const [savedSettings, setSavedSettings] = useState<EventsSettings>(defaultSettings);
  const [channelInput, setChannelInput] = useState("");

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await fetch(
        `/api/events/settings?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json()) as { settings?: EventsSettings };
      if (cancelled) return;
      if (data.settings) {
        setSettings(data.settings);
        setSavedSettings(data.settings);
        setChannelInput(data.settings.whatsapp_channel_ids[0] ?? "");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const dirty =
    JSON.stringify(settings) !== JSON.stringify(savedSettings) ||
    channelInput.trim() !== (savedSettings.whatsapp_channel_ids[0] ?? "");

  const save = useCallback(async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const channelIds = channelInput.trim() ? [channelInput.trim()] : [];
      const res = await fetch("/api/events/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          whatsappChannelIds: channelIds,
          defaultEmbedView: settings.default_embed_view,
          embedMaxItems: settings.embed_max_items,
          embedPlatforms: settings.embed_platforms,
          embedShowAllFilter: settings.embed_show_all_filter,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      const next = { ...settings, whatsapp_channel_ids: channelIds };
      setSettings(next);
      setSavedSettings(next);
    } finally {
      setSaving(false);
    }
  }, [restaurantId, settings, channelInput]);

  const embedPlatformToggleItems = useMemo(
    () =>
      EVENTS_NATIVE_PLATFORMS.map((platform) => {
        const connector = connectors.find((c) => c.key === platform);
        const connected = connector?.connected ?? platform === "gwada";
        return {
          id: platform,
          label: EVENTS_PLATFORM_LABELS[platform],
          togglable: connected || platform === "gwada",
          hint:
            !connected && platform !== "gwada" ? "(nicht verbunden)" : undefined,
          icon: <EventsPlatformIcon platform={platform} className="size-4" />,
        };
      }),
    [connectors],
  );

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;
  if (loading || showSkeleton) {
    return (
      <SkeletonCardFrame className="rounded-2xl border border-border/50 p-6 shadow-card">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-10 w-full" />
      </SkeletonCardFrame>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <div>
          <h2 className="text-base font-semibold">WhatsApp Kanal</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kanal-ID für Event-Ankündigungen beim Erstellen (optional).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="events-wa-channel">Kanal-ID</Label>
          <Input
            id="events-wa-channel"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder="123456789@newsletter"
            disabled={connectorsLoading}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <div>
          <h2 className="text-base font-semibold">{publicSurfaceProfileAndEmbedTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {publicSurfaceProfileAndEmbedDescription}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Standard-Ansicht</Label>
          <Select
            value={settings.default_embed_view}
            onValueChange={(v) =>
              setSettings((s) => ({
                ...s,
                default_embed_view: v === "grid" ? "grid" : "list",
              }))
            }
          >
            <SelectTrigger className={appSelectTriggerAccentCn("h-9 w-full max-w-xs")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">Liste</SelectItem>
              <SelectItem value="grid">Raster</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="events-embed-max">Max. Events in Einbindung</Label>
          <Input
            id="events-embed-max"
            type="number"
            min={1}
            max={100}
            value={settings.embed_max_items}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                embed_max_items: Number(e.target.value) || 24,
              }))
            }
            className="max-w-[8rem]"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="events-embed-all">Chip „Alle“ anzeigen</Label>
          <Switch
            id="events-embed-all"
            checked={settings.embed_show_all_filter}
            onCheckedChange={(checked) =>
              setSettings((s) => ({ ...s, embed_show_all_filter: checked }))
            }
          />
        </div>
        <EmbedProfilePlatformToggles
          platforms={embedPlatformToggleItems}
          values={settings.embed_platforms}
          onChange={(embed_platforms) =>
            setSettings((s) => ({ ...s, embed_platforms }))
          }
        />
      </section>

      <SettingsStickySaveBar show={dirty}>
        <Button
          type="button"
          className={settingsAccentSaveButtonClassName}
          disabled={saving || !dirty}
          onClick={() => void save()}
        >
          Speichern
        </Button>
      </SettingsStickySaveBar>
    </div>
  );
}
