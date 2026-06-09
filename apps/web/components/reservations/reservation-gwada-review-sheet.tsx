"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { ReservationGwadaReviewSummary } from "@/lib/reviews/reservation-gwada-review-types";
import { cn } from "@/lib/utils";

function StarsDisplay({ rating }: { rating: number }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <div className="flex gap-0.5" aria-label={`${rating} von 5 Sternen`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "size-5",
            i < full
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

export function ReservationGwadaReviewSheet({
  open,
  onOpenChange,
  review,
  guestLabel,
  reservationNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: ReservationGwadaReviewSummary | null;
  guestLabel: string;
  reservationNumber: number | null;
}) {
  const dateLabel = review
    ? new Date(review.createdAt).toLocaleString("de-DE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="mx-auto flex max-h-[min(85dvh,520px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Gwada-Bewertung
          </DrawerTitle>
          <DrawerDescription className="text-base text-muted-foreground">
            {guestLabel}
            {reservationNumber != null ? (
              <>
                {" "}
                · Reservierung #{reservationNumber}
              </>
            ) : null}
          </DrawerDescription>
        </DrawerHeader>
        {open && review ? (
          <div className="space-y-4 px-6 pb-6">
            <div className="flex items-center justify-between gap-3">
              <StarsDisplay rating={review.rating} />
              {dateLabel ? (
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={review.createdAt}
                >
                  {dateLabel}
                </time>
              ) : null}
            </div>
            {review.guestDisplayName ? (
              <p className="text-sm font-medium">{review.guestDisplayName}</p>
            ) : null}
            {review.comment ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {review.comment}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Kein Kommentar</p>
            )}
            <Button
              type="button"
              className={cn("h-11 w-full ", brandActionButtonRoundedClassName)}
              render={
                <Link
                  href="/dashboard/bewertungen/uebersicht?platform=gwada"
                  onClick={() => onOpenChange(false)}
                />
              }
              nativeButton={false}
            >
              In Bewertungen öffnen
            </Button>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
