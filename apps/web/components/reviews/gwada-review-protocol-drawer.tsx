"use client";

import { useCallback, useEffect, useState } from "react";
import { DocumentsProtocolTableSkeleton } from "@/components/documents/documents-protocol-table-skeleton";
import { GwadaReviewProtocolTable } from "@/components/reviews/gwada-review-protocol-table";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type {
  GwadaReviewProtocolPayload,
  GwadaReviewsOverviewProtocolPayload,
} from "@/lib/reviews/gwada-review-protocol-types";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

type GwadaReviewProtocolDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
} & (
  | {
      scope: "review";
      reviewId: string | null;
      reviewLabel: string;
    }
  | {
      scope: "overview";
    }
);

export function GwadaReviewProtocolDrawer(props: GwadaReviewProtocolDrawerProps) {
  const { open, onOpenChange, restaurantId, scope } = props;
  const [singlePayload, setSinglePayload] =
    useState<GwadaReviewProtocolPayload | null>(null);
  const [overviewPayload, setOverviewPayload] =
    useState<GwadaReviewsOverviewProtocolPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  const reviewId = scope === "review" ? props.reviewId : null;
  const reviewLabel = scope === "review" ? props.reviewLabel : "";

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    if (scope === "review" && !reviewId) return;

    setLoading(true);
    try {
      if (scope === "overview") {
        const q = new URLSearchParams({ restaurantId });
        const res = await fetch(`/api/reviews/gwada-protocol/overview?${q}`);
        const data = (await res.json()) as GwadaReviewsOverviewProtocolPayload & {
          error?: string;
        };
        if (!res.ok) {
          setOverviewPayload(null);
          return;
        }
        setOverviewPayload(data);
        return;
      }

      const q = new URLSearchParams({ restaurantId, reviewId: reviewId! });
      const res = await fetch(`/api/reviews/gwada-protocol?${q}`);
      const data = (await res.json()) as GwadaReviewProtocolPayload & {
        error?: string;
      };
      if (!res.ok) {
        setSinglePayload(null);
        return;
      }
      setSinglePayload(data);
    } catch {
      setSinglePayload(null);
      setOverviewPayload(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, reviewId, scope]);

  useEffect(() => {
    if (!open) return;
    if (scope === "review" && !reviewId) return;
    void reload();
  }, [open, reviewId, scope, reload]);

  const events =
    scope === "overview"
      ? (overviewPayload?.events ?? [])
      : (singlePayload?.events ?? []);

  const title =
    scope === "overview" ? "Gesamtprotokoll Bewertungen" : "Bewertungsprotokoll";

  const description =
    scope === "overview" ? (
      "Einladungslinks, Versand über WhatsApp oder E-Mail und abgegebene Gwada-Bewertungen — auch ohne abgeschlossene Bewertung."
    ) : (
      <>
        {reviewLabel}
        {singlePayload?.guestLabel ? (
          <>
            {" "}
            ·{" "}
            <span className="text-muted-foreground">{singlePayload.guestLabel}</span>
          </>
        ) : null}
      </>
    );

  const emptyHint =
    scope === "overview"
      ? "Noch keine Einladungen, Versände oder Bewertungen protokolliert."
      : "Keine Protokolldaten für diese Bewertung.";

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="mx-auto flex max-h-[min(88dvh,560px)] max-w-5xl flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {title}
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed">
            {description}
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 sm:px-5">
          {loading && !showSkeleton ? (
            <div className="min-h-48" aria-busy="true" />
          ) : null}
          {showSkeleton ? (
            <DocumentsProtocolTableSkeleton compact />
          ) : events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{emptyHint}</p>
          ) : (
            <GwadaReviewProtocolTable
              events={events}
              onNavigate={() => onOpenChange(false)}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
