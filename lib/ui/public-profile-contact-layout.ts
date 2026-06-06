import { cn } from "@/lib/utils";

/** Kontakt-Chips: Inhalt breit, in der Zeile bei Platz gleichmäßig mitwachsen. */
export const profileContactChipGridClassName = "flex flex-wrap gap-2";

export const profileContactChipClassName = cn(
  "inline-flex min-h-10 min-w-max max-w-full flex-[1_1_0] items-center justify-center gap-2 rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-sm font-medium transition-colors",
  "hover:border-accent/40 hover:bg-accent/5",
);

export const profileContactSocialRowClassName =
  "flex flex-wrap justify-center gap-2 border-t border-border/40 pt-4";
