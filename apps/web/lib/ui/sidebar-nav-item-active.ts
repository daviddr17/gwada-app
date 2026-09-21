import { cn } from "@/lib/utils";

/**
 * Selected sidebar + chip-subnav items.
 * Soft tenant-accent fill (same idea as filter chips) instead of a left-edge
 * stripe — that stripe follows `rounded-md` / `rounded-full` and looks glued on.
 */
export const sidebarNavItemActiveClassName = cn(
  "data-active:bg-accent/10 data-active:font-medium data-active:text-foreground",
  "data-active:hover:bg-accent/15 data-active:hover:text-foreground",
  "data-active:active:bg-accent/15 data-active:active:text-foreground",
);
