"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const CLAMP_CHARS = 160;

export function reviewCommentNeedsExpand(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length > CLAMP_CHARS) return true;
  return trimmed.split(/\n/).length > 4;
}

/** Bewertungstext mit optionalem „Mehr“ — hält Kartenhöhen ruhig ohne Masonry. */
export function ReviewCommentExpandable({
  text,
  emptyLabel = "Kein Kommentar",
  moreLabel = "Mehr",
  lessLabel = "Weniger",
  className,
  textClassName,
  clampClassName = "line-clamp-5",
}: {
  text: string | null | undefined;
  emptyLabel?: string;
  moreLabel?: string;
  lessLabel?: string;
  className?: string;
  textClassName?: string;
  clampClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = text?.trim() || "";

  if (!trimmed) {
    return (
      <p className={cn("text-sm text-muted-foreground", className, textClassName)}>
        {emptyLabel}
      </p>
    );
  }

  const needsExpand = reviewCommentNeedsExpand(trimmed);
  const clamped = needsExpand && !expanded;

  return (
    <div className={cn("space-y-1", className)}>
      <p
        className={cn(
          "text-sm leading-relaxed text-foreground",
          textClassName,
          clamped && clampClassName,
          !clamped && "whitespace-pre-wrap",
        )}
      >
        {trimmed}
      </p>
      {needsExpand ? (
        <button
          type="button"
          className="text-xs font-medium text-accent underline-offset-4 hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      ) : null}
    </div>
  );
}
