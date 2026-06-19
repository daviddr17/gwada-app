"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { EmbedProfilePlatformToggles } from "@/components/embed/embed-profile-platform-toggles";
import { EventsPlatformIcon } from "@/components/events/events-platform-icon";
import { AppNavLink } from "@/components/navigation/app-nav-link";
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

type WahaChannelOption = { id: string; name: string };

type EventsSettings = {
  default_embed_view: "grid" | "list";
  embed_max_items: number;
  embed_platforms: EventsEmbedPlatforms;
  embed_show_all_filter: boolean;
};

function defaultSettings(): EventsSettings {
  return {
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
  const [newsWhatsappChannelIds, setNewsWhatsappChannelIds] = useState<string[]>([]);
  const [whatsappChannels, setWhatsappChannels] = useState<WahaChannelOption[]>([]);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const params = new URLSearchParams({ restaurantId });
      const [eventsRes, newsSettingsRes, channelsRes] = await Promise.all([
        fetch(`/api/events/settings?${params}`),
        fetch(`/api/news/settings?${params}`),
        fetch(`/api/news/whatsapp-channels?${params}`),
      ]);
      const eventsData = (await eventsRes.json()) as { settings?: EventsSettings };
      const newsSettingsData = (await newsSettingsRes.json()) as {
        settings?: { whatsapp_channel_ids?: string[] };
      };
      const channelsData = (await channelsRes.json()) as {
        channels?: WahaChannelOption[];
      };
      if (cancelled) return;
      if (eventsData.settings) {
        setSettings(eventsData.settings);
        setSavedSettings(eventsData.settings);
      }
      setNewsWhatsappChannelIds(newsSettingsData.settings?.whatsapp_channel_ids ?? []);
      setWhatsappChannels(channelsData.channels ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const channelLabelById = useMemo(
    () =>
      new Map(whatsappChannels.map((channel) => [channel.id, channel.name || channel.id])),
    [whatsappChannels],
  );

  const whatsappConnected = useMemo(
    () =>
      connectors.some(
        (connector) => connector.key === "whatsapp_channel" && connector.connected,
      ),
    [connectors],
  );

  const newsWhatsappSelectionLabel = useMemo(() => {
    if (newsWhatsappChannelIds.length === 0) {
      return "Alle OWNER-Kanäle automatisch (News-Einstellung)";
    }
    if (newsWhatsappChannelIds.length === 1) {
      const id = newsWhatsappChannelIds[0]!;
      return channelLabelById.get(id) ?? id;
    }
    return `${newsWhatsappChannelIds.length} Kanäle ausgewählt (News-Einstellung)`;
  }, [channelLabelById, newsWhatsappChannelIds]);

  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const save = useCallback(async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/events/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          defaultEmbedView: settings.default_embed_view,
          embedMaxItems: settings.embed_max_items,
          embedPlatforms: settings.embed_platforms,
          embedShowAllFilter: settings.embed_show_all_filter,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      setSavedSettings(settings);
    } finally {
      setSaving(false);
    }
  }, [restaurantId, settings]);

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
            Event-Ankündigungen nutzen denselben WhatsApp-Kanal wie News.
          </p>
        </div>
        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
          <p className="text-sm font-medium">{newsWhatsappSelectionLabel}</p>
          <p className="text-xs text-muted-foreground">
            {whatsappConnected
              ? "Kanal-Auswahl und Anlegen erfolgen in den News-Einstellungen."
              : "WhatsApp zuerst unter Einstellungen → Integrationen verbinden, danach Kanal in News hinterlegen."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            render={
              <AppNavLink href="/dashboard/news/einstellungen" prefetch={false} />
            }
            nativeButton={false}
            disabled={connectorsLoading}
          >
            In News-Einstellungen ändern
            <ArrowUpRight className="size-4" aria-hidden />
          </Button>
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
