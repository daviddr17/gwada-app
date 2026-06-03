"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReservationGwadaReviewSummary } from "@/lib/reviews/reservation-gwada-review-types";
import { cn } from "@/lib/utils";

export function ReservationGwadaReviewStarButton({
  review,
  className,
  onOpen,
}: {
  review: ReservationGwadaReviewSummary;
  className?: string;
  onOpen: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "size-9 shrink-0 rounded-lg text-amber-500 hover:bg-amber-500/10 hover:text-amber-600",
        className,
      )}
      aria-label={`Gwada-Bewertung: ${review.rating} von 5 Sternen`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onOpen();
      }}
    >
      <Star className="size-4 fill-amber-400" />
    </Button>
  );
}
