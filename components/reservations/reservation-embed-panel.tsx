"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { buildReservationEmbedSnippet } from "@/lib/reservations/embed-snippet";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert.`);
  } catch {
    toast.error("Kopieren fehlgeschlagen.");
  }
}

export function ReservationEmbedPanel() {
  const { restaurantId: restaurantUuid, ready } = useWorkspaceRestaurantUuid();
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
  const snippet = slug ? buildReservationEmbedSnippet(slug, origin) : null;

  const showSkeleton = useDeferredSkeleton(!ready || loadingMeta);

  const markCopied = useCallback((key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  if (!ready || showSkeleton) {
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
          Das Restaurant ist noch nicht veröffentlicht — das eingebettete Formular ist
          für Gäste erst nach Veröffentlichung erreichbar.
        </p>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <div>
          <h2 className="text-base font-semibold">Vorschau</h2>
          <p className="text-sm text-muted-foreground">
            So sieht das Formular mit deinen Akzentfarben aus (eingebettet als iframe).
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/20">
          <iframe
            src={`/embed/reservieren/${encodeURIComponent(slug)}`}
            title="Reservierungsformular Vorschau"
            className="block w-full min-h-[480px] border-0"
            loading="lazy"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <div>
          <h2 className="text-base font-semibold">Code zum Einbinden</h2>
          <p className="text-sm text-muted-foreground">
            Kopiere den iframe in deine Website — optional mit dem kleinen Script für
            automatische Höhenanpassung (wie bei Social-Media-Embeds).
          </p>
        </div>

        {snippet ? (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">iframe</Label>
              <pre className="max-h-40 overflow-auto rounded-xl border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed">
                {snippet.iframe}
              </pre>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  void copyText(snippet.iframe, "iframe-Code");
                  markCopied("iframe");
                }}
              >
                {copiedKey === "iframe" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                iframe kopieren
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                iframe + Höhenanpassung
              </Label>
              <pre className="max-h-52 overflow-auto rounded-xl border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed">
                {snippet.combined}
              </pre>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  void copyText(snippet.combined, "Embed-Code");
                  markCopied("combined");
                }}
              >
                {copiedKey === "combined" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                Kompletten Code kopieren
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Direktlink:{" "}
              <a
                href={snippet.iframe.match(/src="([^"]+)"/)?.[1] ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline-offset-2 hover:underline"
              >
                Formular in neuem Tab öffnen
              </a>
            </p>
          </>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <p>
          Gäste können im Tab „Ändern“ mit <strong>Reservierungsnummer</strong> und{" "}
          <strong>PIN</strong> bestehende Buchungen anpassen. E-Mail- und WhatsApp-Hinweise
          folgen deinen Einstellungen unter Reservierungen → Einstellungen.
        </p>
      </section>
    </div>
  );
}
