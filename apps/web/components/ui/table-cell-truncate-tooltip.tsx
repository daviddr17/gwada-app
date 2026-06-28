"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TableCellTruncateTooltipProps = {
  text: string;
  className?: string;
  /** Kein Tooltip für leere Werte / „—“ (Standard: an). */
  hideWhenEmpty?: boolean;
};

const triggerClassName =
  "inline-flex h-auto min-h-0 min-w-0 max-w-full justify-start truncate rounded-none border-0 bg-transparent p-0 text-left font-normal shadow-none hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:hover:bg-transparent";

function useTextTruncated(text: string) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setTruncated(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, text]);

  return { ref, truncated };
}

/**
 * Tabellentext mit Ellipse — Tooltip nur wenn Inhalt wirklich abgeschnitten ist.
 */
export function TableCellTruncateTooltip({
  text,
  className,
  hideWhenEmpty = true,
}: TableCellTruncateTooltipProps) {
  const trimmed = text.trim();
  const { ref, truncated } = useTextTruncated(text);

  if (hideWhenEmpty && (!trimmed || trimmed === "—")) {
    return <span className={cn("block min-w-0 truncate", className)}>—</span>;
  }

  const label = (
    <span ref={ref} className={cn("block min-w-0 truncate", className)}>
      {text}
    </span>
  );

  if (!truncated) {
    return label;
  }

  return (
    <Tooltip>
      <TooltipTrigger delay={200} className={triggerClassName}>
        {label}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={6}
        className="max-w-[min(24rem,92vw)] whitespace-normal break-words text-left"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
