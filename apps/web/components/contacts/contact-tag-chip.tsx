"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { ContactTagRow } from "@/lib/supabase/contact-tags-db";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function contactTagChipVisual(tag: Pick<ContactTagRow, "background_color">): {
  className: string;
  style?: CSSProperties;
} {
  if (HEX.test(tag.background_color)) {
    const bg = tag.background_color;
    return {
      className:
        "border font-medium shadow-none text-foreground dark:text-foreground",
      style: {
        backgroundColor: `color-mix(in srgb, ${bg} 22%, transparent)`,
        borderColor: `color-mix(in srgb, ${bg} 42%, transparent)`,
      },
    };
  }
  return {
    className: "border-border/40 bg-muted/45 text-foreground dark:bg-muted/35",
  };
}

export function ContactTagChip({
  tag,
  className,
  onClick,
  selected,
}: {
  tag: Pick<ContactTagRow, "id" | "name" | "background_color">;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const visual = contactTagChipVisual(tag);
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight",
        onClick && "transition-opacity hover:opacity-90",
        selected && "ring-2 ring-ring ring-offset-1 ring-offset-background",
        visual.className,
        className,
      )}
      style={visual.style}
      title={tag.name}
    >
      {tag.name}
    </Comp>
  );
}
