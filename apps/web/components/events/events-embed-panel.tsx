"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { EmbedApiInfoCard } from "@/components/embed/embed-api-info-card";
import { EmbedDualThemePreviewFrame, embedPreviewSectionHint } from "@/components/embed/embed-dual-theme-preview";
import { EmbedSnippetCodeBlock } from "@/components/embed/embed-snippet-code-block";
import { EmbedTextThemeSetting } from "@/components/embed/embed-text-theme-setting";
import { buildEventInquiryEmbedSnippet, buildEventsEmbedSnippet } from "@/lib/embed/build-embed-snippet";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert.`);
  } catch {
    toast.error("Kopieren fehlgeschlagen.");
  }
}

export function EventsEmbedPanel() {
  const { restaurantId: restaurantUuid, ready } = useWorkspaceRestaurantUuid();
  const { getProfileForRestaurantId, isReady: profileReady } = useRestaurantProfile();
  const [published, setPublished] = useState<boolean | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
      setPublished(error ? null : Boolean(data?.is_published));
      setLoadingMeta(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantUuid]);

  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const snippet = slug ? buildEventsEmbedSnippet(slug, origin) : null;
  const inquirySnippet = slug ? buildEventInquiryEmbedSnippet(slug, origin) : null;
  const showSkeleton = useDeferredSkeleton(!ready || loadingMeta);

  const markCopied = useCallback((key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  if (!ready || loadingMeta || showSkeleton) {
    return (
      <SkeletonCardFrame className="rounded-2xl border border-border/50 p-6 shadow-card">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-4 h-32 w-full" />
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
    <div className="space-y-6">
      {published === false ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Das Restaurant ist noch nicht veröffentlicht — die eingebetteten Widgets sind
          für Gäste erst nach Veröffentlichung erreichbar.
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <h2 className="text-base font-semibold">Öffentliche Events</h2>
        <p className="text-sm text-muted-foreground">
          Feed mit veröffentlichten Terminen für Profil und Website — ohne private
          Veranstaltungen.
        </p>
        <EmbedTextThemeSetting restaurantId={restaurantUuid} widget="events" />
        {snippet ? (
          <>
            <EmbedSnippetCodeBlock code={snippet.recommended} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void copyText(snippet.recommended, "Events-Code");
                markCopied("events");
              }}
            >
              {copiedKey === "events" ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              Code kopieren
            </Button>
            <p className="text-xs text-muted-foreground">{embedPreviewSectionHint}</p>
            <EmbedDualThemePreviewFrame
              embedUrl={snippet.embedUrl}
              widget="events"
              title="Öffentliche Events Vorschau"
              minHeight={520}
            />
          </>
        ) : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <h2 className="text-base font-semibold">Veranstaltungs-Anfrage</h2>
        <p className="text-sm text-muted-foreground">
          Buchungsanfrage für private Feiern. Anfragen erscheinen in Events als Vorgang
          — nicht im öffentlichen Feed. Pakete pflegst du unter Einstellungen.
        </p>
        <EmbedTextThemeSetting restaurantId={restaurantUuid} widget="event_inquiry" />
        {inquirySnippet ? (
          <>
            <EmbedSnippetCodeBlock code={inquirySnippet.recommended} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void copyText(inquirySnippet.recommended, "Anfrage-Code");
                markCopied("inquiry");
              }}
            >
              {copiedKey === "inquiry" ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              Code kopieren
            </Button>
            <p className="text-xs text-muted-foreground">{embedPreviewSectionHint}</p>
            <EmbedDualThemePreviewFrame
              embedUrl={inquirySnippet.embedUrl}
              widget="event_inquiry"
              title="Veranstaltungs-Anfrage Vorschau"
              minHeight={520}
            />
          </>
        ) : null}
      </section>

      <EmbedApiInfoCard moduleId="events" />
    </div>
  );
}
