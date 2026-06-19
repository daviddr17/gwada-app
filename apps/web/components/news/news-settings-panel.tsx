"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { EmbedProfilePlatformToggles } from "@/components/embed/embed-profile-platform-toggles";
import { EmbedNewsWidget } from "@/components/embed/embed-news-widget";
import {
  CreateWhatsappNewsChannelDialog,
  CreateWhatsappNewsChannelTrigger,
} from "@/components/news/create-whatsapp-news-channel-dialog";
import { NewsPlatformIcon } from "@/components/news/news-platform-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useAccentColor } from "@/lib/contexts/accent-color-context";
import {
  NEWS_FILTER_LABELS,
  NEWS_PLATFORM_LABELS,
  NEWS_PLATFORM_ORDER,
} from "@/lib/constants/news-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useNewsPlatformConnections } from "@/lib/hooks/use-news-platform-connections";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  defaultEmbedPlatforms,
  filterItemsForEmbed,
  filterPlatformsForEmbed,
  type NewsEmbedPlatforms,
} from "@/lib/news/news-embed-platforms";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  publicSurfaceProfileAndEmbedDescription,
  publicSurfaceProfileAndEmbedTitle,
  publicSurfaceScopeHint,
} from "@/lib/ui/public-surface-settings-copy";
import { cn } from "@/lib/utils";

type WahaChannelOption = { id: string; name: string };
type NewsSettings = {
  whatsapp_channel_ids: string[];
  default_embed_view: "grid" | "list";
  embed_max_items: number;
  embed_platforms: NewsEmbedPlatforms;
  embed_show_all_filter: boolean;
};

function defaultNewsSettings(): NewsSettings {
  return {
    whatsapp_channel_ids: [],
    default_embed_view: "grid",
    embed_max_items: 24,
    embed_platforms: defaultEmbedPlatforms(),
    embed_show_all_filter: true,
  };
}

function cloneNewsSettings(settings: NewsSettings): NewsSettings {
  return {
    ...settings,
    whatsapp_channel_ids: [...settings.whatsapp_channel_ids],
    embed_platforms: { ...settings.embed_platforms },
  };
}

export function NewsSettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { accentHex } = useAccentColor();
  const { connectors, loading: connectorsLoading } =
    useNewsPlatformConnections(restaurantId);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<WahaChannelOption[]>([]);
  const [previewItems, setPreviewItems] = useState<UnifiedNewsItem[]>([]);
  const [settings, setSettings] = useState<NewsSettings>(defaultNewsSettings);
  const [savedSettings, setSavedSettings] = useState<NewsSettings>(defaultNewsSettings);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);

  const whatsappConnected = useMemo(
    () =>
      connectors.some(
        (connector) => connector.key === "whatsapp_channel" && connector.connected,
      ),
    [connectors],
  );

  const canCreateWhatsappChannel = whatsappConnected && channels.length === 0;

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings],
  );

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [settingsRes, channelsRes, newsRes] = await Promise.all([
        fetch(`/api/news/settings?restaurantId=${encodeURIComponent(restaurantId)}`),
        fetch(
          `/api/news/whatsapp-channels?restaurantId=${encodeURIComponent(restaurantId)}`,
        ),
        fetch(`/api/news?${new URLSearchParams({ restaurantId })}`),
      ]);
      const settingsData = (await settingsRes.json()) as {
        settings?: NewsSettings;
        error?: string;
      };
      const channelsData = (await channelsRes.json()) as {
        channels?: WahaChannelOption[];
      };
      const newsData = (await newsRes.json()) as { items?: UnifiedNewsItem[] };
      if (settingsRes.ok && settingsData.settings) {
        const next = cloneNewsSettings(settingsData.settings);
        setSettings(next);
        setSavedSettings(next);
      }
      setChannels(channelsData.channels ?? []);
      setPreviewItems(newsData.items ?? []);
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

  const connectedPlatforms = useMemo(
    () =>
      connectors
        .filter((connector) => connector.connected && connector.capabilities.canReadFeed)
        .map((connector) => connector.key),
    [connectors],
  );

  const previewConnectedPlatforms = useMemo(
    () =>
      filterPlatformsForEmbed(connectedPlatforms, settings.embed_platforms),
    [connectedPlatforms, settings.embed_platforms],
  );

  const previewItemsFiltered = useMemo(
    () =>
      filterItemsForEmbed(previewItems, settings.embed_platforms)
        .filter((item) => item.status === "published")
        .slice(0, settings.embed_max_items),
    [previewItems, settings.embed_platforms, settings.embed_max_items],
  );

  const save = async () => {
    if (!restaurantId || !dirty) return;
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
          embedPlatforms: settings.embed_platforms,
          embedShowAllFilter: settings.embed_show_all_filter,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save_failed");
      setSavedSettings(cloneNewsSettings(settings));
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

  const embedPlatformToggleItems = useMemo(
    () =>
      NEWS_PLATFORM_ORDER.map((platform) => {
        const connector = connectors.find((c) => c.key === platform);
        const connected = connector?.connected ?? platform === "gwada";
        return {
          id: platform,
          label: NEWS_PLATFORM_LABELS[platform],
          togglable: connected || platform === "gwada",
          hint:
            !connected && platform !== "gwada"
              ? "(nicht verbunden)"
              : undefined,
          icon: <NewsPlatformIcon platform={platform} className="size-4" />,
        };
      }),
    [connectors],
  );

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (loading && showSkeleton) {
    return (
      <div className="flex flex-col gap-6 pb-4">
        <SkeletonCardFrame className="rounded-2xl border border-border/50 p-6 shadow-card">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-4 h-10 w-full" />
          <Skeleton className="mt-3 h-10 w-full" />
        </SkeletonCardFrame>
        <SkeletonCardFrame className="rounded-2xl border border-border/50 p-6 shadow-card">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-4 h-24 w-full" />
        </SkeletonCardFrame>
      </div>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-6", dirty ? "pb-24" : "pb-4")}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Dashboard</CardTitle>
          <CardDescription>
            Kanäle und Synchronisierung für News im Gwada-Dashboard — Beiträge
            werden automatisch von verbundenen Plattformen geladen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Plattform-Status</Label>
            <ul className="space-y-2 rounded-xl border border-border/50 bg-muted/15 p-3">
              {connectorsLoading ? (
                <li className="text-sm text-muted-foreground">Status wird geladen …</li>
              ) : (
                NEWS_PLATFORM_ORDER.map((platform) => {
                  const connector = connectors.find((c) => c.key === platform);
                  const connected = connector?.connected ?? platform === "gwada";
                  return (
                    <li
                      key={platform}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <NewsPlatformIcon platform={platform} className="size-4" />
                        <span className="truncate">{NEWS_PLATFORM_LABELS[platform]}</span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          connected
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {connected ? "Verbunden" : "Nicht verbunden"}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
            <p className="text-xs text-muted-foreground">
              Externe Kanäle unter Einstellungen → Integrationen verbinden. Im
              Dashboard synchronisiert Gwada Beiträge im Hintergrund.
            </p>
          </div>

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
                        <div className="space-y-2 px-2 py-1.5">
                          <p className="text-sm text-muted-foreground">
                            {whatsappConnected
                              ? "Noch kein WhatsApp-Newsletter-Kanal — hier anlegen."
                              : "Keine OWNER-Kanäle gefunden. WhatsApp zuerst unter Integrationen verbinden."}
                          </p>
                          {canCreateWhatsappChannel ? (
                            <CreateWhatsappNewsChannelTrigger
                              onClick={() => {
                                setChannelsOpen(false);
                                setCreateChannelOpen(true);
                              }}
                            />
                          ) : null}
                        </div>
                      ) : (
                        channels.map((channel) => {
                          const checked = settings.whatsapp_channel_ids.includes(
                            channel.id,
                          );
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
                        className="mt-2 h-8 w-full justify-start gap-2 rounded-lg px-2 text-muted-foreground"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            whatsapp_channel_ids: [],
                          }))
                        }
                      >
                        <RotateCcw className="size-4 shrink-0 opacity-60" aria-hidden />
                        Alle OWNER-Kanäle (automatisch)
                      </Button>
                    ) : null}
                  </PopoverContent>
                </PopoverPositioner>
              </PopoverPortal>
            </Popover>
            {canCreateWhatsappChannel ? (
              <CreateWhatsappNewsChannelTrigger
                onClick={() => setCreateChannelOpen(true)}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <CreateWhatsappNewsChannelDialog
        restaurantId={restaurantId}
        open={createChannelOpen}
        onOpenChange={setCreateChannelOpen}
        onCreated={({ channel, whatsappChannelIds }) => {
          setChannels([{ id: channel.id, name: channel.name }]);
          const next = cloneNewsSettings({
            ...settings,
            whatsapp_channel_ids: whatsappChannelIds,
          });
          setSettings(next);
          setSavedSettings(next);
          void load();
        }}
      />

      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">{publicSurfaceProfileAndEmbedTitle}</CardTitle>
          <CardDescription>
            {publicSurfaceProfileAndEmbedDescription} Änderungen gelten erst nach
            Speichern (sticky Leiste unten).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {dirty ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
              Ungespeicherte Änderungen — bitte unten speichern, damit Profil und
              Einbindung aktualisiert werden.
            </p>
          ) : null}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Plattformen</Label>
              <p className="text-xs text-muted-foreground">
                {publicSurfaceScopeHint("both")} Nur aktivierte und verbundene
                Plattformen erscheinen in der Ansicht.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor="embed-show-all-filter" className="text-sm">
                  {NEWS_FILTER_LABELS.all}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Gemeinsame Übersicht über alle aktiven Plattformen (Chip „Alle“).{" "}
                  {publicSurfaceScopeHint("both")} Aus: Gäste sehen nur
                  Einzelplattformen, kein gemischter Feed.
                </p>
              </div>
              <Switch
                id="embed-show-all-filter"
                checked={settings.embed_show_all_filter}
                onCheckedChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    embed_show_all_filter: value === true,
                  }))
                }
                aria-label="Chip Alle in Profil und Einbindung"
              />
            </div>
            <EmbedProfilePlatformToggles
              platforms={embedPlatformToggleItems}
              values={settings.embed_platforms}
              onChange={(embed_platforms) =>
                setSettings((prev) => ({ ...prev, embed_platforms }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Ansicht</Label>
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
                <SelectItem value="grid">Raster (Kacheln)</SelectItem>
                <SelectItem value="list">Liste</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {publicSurfaceScopeHint("both")} Raster: neueste Beiträge links oben,
              zeilenweise. Liste: chronologisch untereinander.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="embed-max-items">Max. Beiträge</Label>
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
              className="h-10 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              {publicSurfaceScopeHint("both")}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Vorschau</Label>
            <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/20">
              <EmbedNewsWidget
                accentHex={accentHex}
                viewMode={settings.default_embed_view}
                connectedPlatforms={previewConnectedPlatforms}
                items={previewItemsFiltered}
                showAllPlatformFilter={settings.embed_show_all_filter}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Vorschau inkl. ungespeicherter Änderungen ({publicSurfaceScopeHint("both").replace(/\.$/, "")}).
              Nach dem Speichern sind Profil und Einbindung aktualisiert.
            </p>
          </div>
        </CardContent>
      </Card>

      <SettingsStickySaveBar show={dirty}>
        <Button
          type="submit"
          disabled={saving || loading}
          className={cn(
            "h-11 w-full min-w-[12rem] sm:w-auto",
            settingsAccentSaveButtonClassName,
          )}
        >
          {saving ? "Speichern …" : "Speichern"}
        </Button>
      </SettingsStickySaveBar>
    </form>
  );
}
