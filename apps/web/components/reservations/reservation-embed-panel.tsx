"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { EmbedSnippetCodeBlock } from "@/components/embed/embed-snippet-code-block";
import { buildReservationEmbedSnippet } from "@/lib/embed/build-embed-snippet";
import {
  isGwadaEmbedLegacyResizeMessage,
  isGwadaEmbedResizeMessage,
} from "@/lib/embed/embed-protocol";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert.`);
  } catch {
    toast.error("Kopieren fehlgeschlagen.");
  }
}

function EmbedPreviewFrame({ src }: { src: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;

      let height: number | null = null;
      if (isGwadaEmbedResizeMessage(event.data)) {
        height = event.data.height;
      } else if (isGwadaEmbedLegacyResizeMessage(event.data)) {
        height = event.data.height;
      }
      if (!height || height <= 0) return;
      frame.style.height = `${Math.ceil(height)}px`;
      frame.style.minHeight = "0";
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="Reservierungsformular Vorschau"
      className="block w-full min-h-[420px] border-0"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
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
          Das Restaurant ist noch nicht veröffentlicht — das eingebettete Formular ist
          für Gäste erst nach Veröffentlichung erreichbar.
        </p>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <div>
          <h2 className="text-base font-semibold">Vorschau</h2>
          <p className="text-sm text-muted-foreground">
            Eingebettetes Formular mit automatischer Höhenanpassung (wie auf der
            Gast-Website mit gwada.js).
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/20">
          {snippet ? <EmbedPreviewFrame src={snippet.embedUrl} /> : null}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card">
        <div>
          <h2 className="text-base font-semibold">Code zum Einbinden</h2>
          <p className="text-sm text-muted-foreground">
            Empfohlen: Platzhalter + ein Gwada-Script (wie Social-Media-Embeds). Höhe,
            Lazy Load und mehrere Widgets auf einer Seite werden automatisch
            übernommen. Später auch Speisekarte und Kontakt über{" "}
            <code className="text-xs">data-gwada-widget</code>.
          </p>
        </div>

        {snippet ? (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Empfohlen (Platzhalter + gwada.js)
              </Label>
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

            <details className="rounded-xl border border-border/50 bg-muted/15 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-foreground">
                Alternativ: rohes iframe (Legacy)
              </summary>
              <div className="mt-3 space-y-3 text-muted-foreground">
                <p className="text-xs">
                  Nur wenn kein externes Script erlaubt ist. Höhe ggf. manuell oder mit
                  Legacy-Snippet unten anpassen.
                </p>
                <EmbedSnippetCodeBlock
                  code={snippet.legacyCombined}
                  className="max-h-40 rounded-lg border-border/40"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    void copyText(snippet.legacyCombined, "Legacy-Embed");
                    markCopied("legacy");
                  }}
                >
                  {copiedKey === "legacy" ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  Legacy kopieren
                </Button>
              </div>
            </details>

            <p className="text-xs text-muted-foreground">
              Loader:{" "}
              <a
                href={snippet.loaderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline-offset-2 hover:underline"
              >
                {snippet.loaderUrl}
              </a>
              {" · "}
              Direktlink:{" "}
              <a
                href={snippet.embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline-offset-2 hover:underline"
              >
                Formular in neuem Tab
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
