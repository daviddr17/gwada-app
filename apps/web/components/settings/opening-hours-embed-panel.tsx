"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { EmbedSnippetCodeBlock } from "@/components/embed/embed-snippet-code-block";
import { EmbedTextThemeSetting } from "@/components/embed/embed-text-theme-setting";
import { buildOpeningHoursEmbedSnippet } from "@/lib/embed/build-embed-snippet";
import { attachEmbedHostBridge } from "@/lib/embed/embed-host-bridge";
import { useEmbedPreviewResize } from "@/lib/embed/use-embed-preview-resize";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  fetchOpeningHoursSettingsForRestaurant,
  upsertOpeningHoursSettingsForRestaurant,
} from "@/lib/supabase/opening-hours-settings-db";
import { publicSurfaceEmbedOnlyDescription, publicSurfaceScopeHint } from "@/lib/ui/public-surface-settings-copy";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert.`);
  } catch {
    toast.error("Kopieren fehlgeschlagen.");
  }
}

const OPENING_HOURS_PREVIEW_EMBED_ID = "gwada-opening-hours-embed-preview";

function EmbedPreviewFrame({ src }: { src: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const previewSrc = useMemo(() => {
    if (!mounted) return src;
    const url = new URL(src, window.location.origin);
    url.searchParams.set("gwada_embed_id", OPENING_HOURS_PREVIEW_EMBED_ID);
    url.searchParams.set("gwada_widget", "opening_hours");
    return url.toString();
  }, [src, mounted]);

  useEmbedPreviewResize(iframeRef, previewSrc);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    return attachEmbedHostBridge(frame, window.location.origin);
  }, [previewSrc]);

  return (
    <iframe
      ref={iframeRef}
      id={OPENING_HOURS_PREVIEW_EMBED_ID}
      src={previewSrc}
      title="Öffnungszeiten Vorschau"
      className="block w-full min-h-[420px] border-0"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

export function OpeningHoursEmbedPanel() {
  const { restaurantId: restaurantUuid, ready } = useWorkspaceRestaurantUuid();
  const { getProfileForRestaurantId, isReady: profileReady } =
    useRestaurantProfile();
  const [published, setPublished] = useState<boolean | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [embedShowKitchenHours, setEmbedShowKitchenHours] = useState(true);
  const [embedShowExceptions, setEmbedShowExceptions] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const profile = useMemo(() => {
    if (!restaurantUuid || !profileReady) return null;
    return getProfileForRestaurantId(restaurantUuid);
  }, [restaurantUuid, profileReady, getProfileForRestaurantId]);

  const slug = profile?.slug?.trim() ?? "";

  useEffect(() => {
    if (!restaurantUuid) {
      setLoadingMeta(false);
      setPublished(null);
      return;
    }
    let cancelled = false;
    setLoadingMeta(true);
    void (async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("restaurants")
        .select("is_published")
        .eq("id", restaurantUuid)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setPublished(null);
      } else {
        setPublished(Boolean(data?.is_published));
      }
      setLoadingMeta(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantUuid]);

  useEffect(() => {
    if (!restaurantUuid) {
      setSettingsLoading(false);
      return;
    }
    let cancelled = false;
    setSettingsLoading(true);
    void (async () => {
      const row = await fetchOpeningHoursSettingsForRestaurant(restaurantUuid);
      if (cancelled) return;
      setEmbedShowKitchenHours(row.embedShowKitchenHours);
      setEmbedShowExceptions(row.embedShowExceptions);
      setSettingsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantUuid]);

  const persistEmbedOption = useCallback(
    async (patch: {
      embedShowKitchenHours?: boolean;
      embedShowExceptions?: boolean;
    }) => {
      if (!restaurantUuid) return;
      const current = await fetchOpeningHoursSettingsForRestaurant(restaurantUuid);
      const next = {
        ...current,
        ...patch,
      };
      const result = await upsertOpeningHoursSettingsForRestaurant(
        restaurantUuid,
        next,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
    },
    [restaurantUuid],
  );

  const origin =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const snippet = slug ? buildOpeningHoursEmbedSnippet(slug, origin) : null;

  const showSkeleton = useDeferredSkeleton(
    !ready || loadingMeta || settingsLoading,
  );

  const markCopied = useCallback((key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  if (!ready || loadingMeta || settingsLoading || showSkeleton) {
    return (
      <SkeletonCardFrame className="rounded-2xl border border-border/50 p-6 shadow-card">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-4 h-32 w-full" />
        <Skeleton className="mt-3 h-10 w-40" />
      </SkeletonCardFrame>
    );
  }

  if (!restaurantUuid || !slug) {
    return (
      <p className="text-sm text-muted-foreground">
        Bitte zuerst einen Restaurant-Nickname (Slug) in den Stammdaten hinterlegen.
      </p>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {published === false ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Das Restaurant ist noch nicht veröffentlicht — das eingebettete Widget ist
          für Gäste erst nach Veröffentlichung erreichbar.
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <h2 className="text-base font-semibold">Anzeige in der Einbindung</h2>
        <p className="text-xs text-muted-foreground">
          {publicSurfaceEmbedOnlyDescription} Änderungen werden sofort gespeichert.
          Hinweistext unter Öffnungszeiten findest du in den Öffnungszeiten-Einstellungen.
        </p>
        <div className="space-y-3">
          <EmbedTextThemeSetting
            restaurantId={restaurantUuid}
            widget="opening_hours"
          />
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="embed-show-kitchen" className="text-sm">
                Küchenzeiten anzeigen
              </Label>
              <p className="text-xs text-muted-foreground">
                Nur wenn eigene Küchenzeiten in den Öffnungszeiten aktiviert sind.{" "}
                {publicSurfaceScopeHint("embed")}
              </p>
            </div>
            <Switch
              id="embed-show-kitchen"
              checked={embedShowKitchenHours}
              onCheckedChange={(v) => {
                const next = v === true;
                setEmbedShowKitchenHours(next);
                void persistEmbedOption({ embedShowKitchenHours: next });
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="embed-show-exceptions" className="text-sm">
                Sondertermine anzeigen
              </Label>
              <p className="text-xs text-muted-foreground">
                Ausnahmen von heute bis Ende des Folgemonats, hervorgehoben als
                Sonderöffnung. {publicSurfaceScopeHint("embed")}
              </p>
            </div>
            <Switch
              id="embed-show-exceptions"
              checked={embedShowExceptions}
              onCheckedChange={(v) => {
                const next = v === true;
                setEmbedShowExceptions(next);
                void persistEmbedOption({ embedShowExceptions: next });
              }}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <h2 className="text-base font-semibold">Code zum Einbinden</h2>

        {snippet ? (
          <>
            <div className="space-y-2">
              <EmbedSnippetCodeBlock code={snippet.recommended} />
              <Button
                type="button"
                className="rounded-lg"
                size="sm"
                onClick={() => {
                  void copyText(snippet.recommended, "Embed-Code");
                  markCopied("recommended");
                }}
              >
                {copiedKey === "recommended" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                Code kopieren
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Direktlink:{" "}
              <a
                href={snippet.embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline-offset-2 hover:underline"
              >
                Öffnungszeiten in neuem Tab
              </a>
            </p>
          </>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <h2 className="text-base font-semibold">Vorschau</h2>
        <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/20">
          {snippet ? <EmbedPreviewFrame src={snippet.embedUrl} /> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <p>
          Reguläre Öffnungszeiten werden immer angezeigt. Hinweistext unter den Zeiten
          kannst du in den Öffnungszeiten-Einstellungen pflegen — er erscheint nach dem
          Speichern im Embed.
        </p>
      </section>
    </div>
  );
}
