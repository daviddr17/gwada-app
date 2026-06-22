import { cn } from "@/lib/utils";

/** Vollbild-Shell: Header + scrollbarer Inhalt + Footer fixiert. */
export const displayChromeShellClassName =
  "flex h-dvh min-h-dvh flex-col overflow-hidden bg-background";

export const displayChromeHeaderClassName =
  "sticky top-0 z-40 flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-border/20 bg-background/95 px-4 py-2 backdrop-blur-sm sm:px-5";

export const displayChromeMainClassName = "min-h-0 flex-1 overflow-y-auto";

export const displayChromeFooterClassName =
  "sticky bottom-0 z-40 shrink-0 border-t border-border/20 bg-background/95 backdrop-blur-sm";

export const displayChromeModeToggleClassName =
  "size-9 shrink-0 rounded-full border-border/60 bg-card/90 shadow-none backdrop-blur-sm dark:shadow-sm";

export function displayChromeMainCn(...parts: Array<string | false | null | undefined>) {
  return cn(displayChromeMainClassName, ...parts);
}
