"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TableCellTruncateTooltipProps = {
  text: string;
  className?: string;
  hideWhenEmpty?: boolean;
};

/**
 * Abgeschnittener Tabellentext mit Hover-Tooltip (Portal).
 * Trigger als unstyled Button — zuverlässiger als `title` in overflow-Tabellen.
 */
export function TableCellTruncateTooltip({
  text,
  className,
  hideWhenEmpty = true,
}: TableCellTruncateTooltipProps) {
  const trimmed = text.trim();
  if (hideWhenEmpty && (!trimmed || trimmed === "—")) {
    return <span className={cn("block min-w-0 truncate", className)}>—</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        delay={200}
        className={cn(
          "inline-flex h-auto min-h-0 min-w-0 max-w-full justify-start truncate rounded-none border-0 bg-transparent p-0 text-left font-normal shadow-none",
          "hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
          "dark:hover:bg-transparent",
          className,
        )}
      >
        <span className="block min-w-0 truncate">{text}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={6}
        className="max-w-[min(24rem,92vw)] whitespace-normal break-all text-left"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
