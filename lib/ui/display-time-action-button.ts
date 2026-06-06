import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

/** Große Touch-Aktionen in Display-Zeiterfassung — Akzent wie andere Display-CTAs. */
export const displayTimeActionButtonBaseClassName =
  "relative h-16 overflow-hidden rounded-2xl pl-6 text-lg";

export const displayTimeActionButtonPrimaryClassName = cn(
  displayTimeActionButtonBaseClassName,
  brandActionButtonClassName,
);

export const displayTimeActionButtonOutlineClassName = cn(
  displayTimeActionButtonBaseClassName,
  "border-border/60 bg-card shadow-none hover:bg-muted/80",
);
