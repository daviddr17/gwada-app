"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { EmbedApiInfoCard } from "@/components/embed/embed-api-info-card";
import { EmbedDualThemePreviewPane, embedPreviewSectionHint } from "@/components/embed/embed-dual-theme-preview";
import { EmbedReviewsWidget } from "@/components/embed/embed-reviews-widget";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { EmbedSnippetCodeBlock } from "@/components/embed/embed-snippet-code-block";
import { EmbedTextThemeSetting } from "@/components/embed/embed-text-theme-setting";
import { buildReviewsEmbedSnippet } from "@/lib/embed/build-embed-snippet";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useAccentColor } from "@/lib/contexts/accent-color-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  publicSurfaceProfileAndEmbedDescription,
} from "@/lib/ui/public-surface-settings-copy";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert.`);
  } catch {
    toast.error("Kopieren fehlgeschlagen.");
  }
}

const PREVIEW_REVIEWS = [
  {
    id: "preview-1",
    platform: "gwada" as const,
    rating: 5,
    comment: "Tolles Essen und sehr freundlicher Service — kommen gerne wieder!",
    authorName: "Anna M.",
    createdAt: new Date().toISOString(),
    reply: null,
  },
  {
    id: "preview-2",
    platform: "google" as const,
    rating: 4,
    comment: "Leckere Gerichte, etwas Wartezeit am Freitagabend.",
    authorName: "Thomas K.",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    reply: "Danke für euren Besuch!",
  },
];

function EmbedReviewsDualPreview({
  accentHex,
  restaurantName,
}: {
  accentHex: string;
  restaurantName: string;
}) {
  const previewProps = {
    restaurantName,
    accentHex,
    reviews: PREVIEW_REVIEWS,
    summary: {
      count: 2,
      average: 4.5,
      median: 4.5,
      distribution: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 },
    } as const,
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <EmbedDualThemePreviewPane textTheme="dark" label="Dunkle Schrift">
        <EmbedReviewsWidget {...previewProps} textTheme="dark" />
      </EmbedDualThemePreviewPane>
      <EmbedDualThemePreviewPane textTheme="light" label="Helle Schrift">
        <EmbedReviewsWidget {...previewProps} textTheme="light" />
      </EmbedDualThemePreviewPane>
    </div>
  );
}

export function ReviewsEmbedPanel() {
  const { restaurantId: restaurantUuid, ready } = useWorkspaceRestaurantUuid();
  const { accentHex } = useAccentColor();
  const { getProfileForRestaurantId, isReady: profileReady } =
    useRestaurantProfile();
  const [published, setPublished] = useState<boolean | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const profile = useMemo(() => {
    if (!restaurantUuid || !profileReady) return null;
    return getProfileForRestaurantId(restaurantUuid);
  }, [restaurantUuid, profileReady, getProfileForRestaurantId]);

  const slug = profile?.slug?.trim() ?? "";
  const restaurantName = profile?.name?.trim() || "Restaurant";

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

  const origin =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const snippet = slug ? buildReviewsEmbedSnippet(slug, origin) : null;

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
    <div className="space-y-6">
      {published === false ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Das Restaurant ist noch nicht veröffentlicht — das eingebettete
          Bewertungs-Widget ist für Gäste erst nach Veröffentlichung erreichbar.
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <div>
          <h2 className="text-base font-semibold">Profil & Einbindung</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {publicSurfaceProfileAndEmbedDescription}
          </p>
        </div>

        <div className="space-y-1">
          <Label>Standard-Ansicht in der Einbindung</Label>
          <p className="text-sm text-foreground">Timeline</p>
          <p className="text-xs text-muted-foreground">
            Chronologische Darstellung mit Datumsspalte — im öffentlichen Profil und in
            der Website-Einbindung identisch.
          </p>
        </div>

        <EmbedTextThemeSetting restaurantId={restaurantUuid} widget="reviews" />
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
                Bewertungen in neuem Tab
              </a>
            </p>
          </>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <h2 className="text-base font-semibold">Vorschau</h2>
        <p className="text-xs text-muted-foreground">{embedPreviewSectionHint}</p>
        {snippet ? (
          <EmbedReviewsDualPreview
            accentHex={accentHex}
            restaurantName={restaurantName}
          />
        ) : null}
      </section>

      <EmbedApiInfoCard moduleId="reviews" />
    </div>
  );
}
