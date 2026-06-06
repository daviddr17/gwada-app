"use client";

import type { MouseEvent } from "react";
import type { PublicOpeningStatus } from "@/lib/restaurant/public-opening-status";
import { cn } from "@/lib/utils";

const openingStatusChipClassName: Record<
  PublicOpeningStatus["state"],
  string
> = {
  open: "border-emerald-500/40 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100",
  opens_later:
    "border-amber-500/50 bg-amber-500/16 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/14 dark:text-amber-50",
  closed:
    "border-border/60 bg-muted/40 text-foreground/90 dark:text-foreground/85",
};

const openingStatusDotClassName: Record<
  PublicOpeningStatus["state"],
  string
> = {
  open: "bg-emerald-500",
  opens_later: "bg-amber-500 dark:bg-amber-400",
  closed: "bg-muted-foreground/55",
};

export function publicOpeningStatusLabelText(
  opening: PublicOpeningStatus,
): string {
  return opening.detail
    ? `${opening.label} · ${opening.detail}`
    : opening.label;
}

function OpeningStatusChipContent({
  opening,
}: {
  opening: PublicOpeningStatus;
}) {
  return (
    <>
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          openingStatusDotClassName[opening.state],
        )}
        aria-hidden
      />
      <span className="min-w-0 truncate">{opening.label}</span>
      {opening.detail ? (
        <span className="shrink-0 font-normal opacity-90">· {opening.detail}</span>
      ) : null}
    </>
  );
}

export function PublicProfileOpeningStatusChip({
  opening,
  className,
  onPress,
}: {
  opening: PublicOpeningStatus;
  className?: string;
  onPress?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const chipClassName = cn(
    "inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium",
    openingStatusChipClassName[opening.state],
    onPress &&
      "cursor-pointer transition-[transform,opacity,box-shadow] hover:opacity-95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    className,
  );

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className={chipClassName}
        aria-label={`Öffnungszeiten: ${publicOpeningStatusLabelText(opening)}`}
      >
        <OpeningStatusChipContent opening={opening} />
      </button>
    );
  }

  return (
    <span className={chipClassName}>
      <OpeningStatusChipContent opening={opening} />
    </span>
  );
}
