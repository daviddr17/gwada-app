"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type ReviewRatingStarsProps = {
  rating: number;
  className?: string;
  size?: "xs" | "sm";
};

export function ReviewRatingStars({
  rating,
  className,
  size = "sm",
}: ReviewRatingStarsProps) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  const iconClass = size === "xs" ? "size-3" : "size-3.5";

  return (
    <div
      className={cn("flex shrink-0 gap-0.5", className)}
      aria-label={`${rating} von 5 Sternen`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            iconClass,
            i < full
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

export function parseReviewNotificationRating(
  value: string | undefined,
): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.min(5, n);
}
