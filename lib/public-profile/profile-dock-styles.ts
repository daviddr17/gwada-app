import { cn } from "@/lib/utils";

/** Glas-Pill — Icon-Dock (iOS-26-ähnlich, volle Kapsel-Rundung) */
export const profileDockShellClassName = "rounded-full";

/** Glas-Kapsel — Innenabstand Icon-Dock (Start + Sheet) */
export const profileDockIconContainerClassName = "p-1.5";

/** Aktiver Slot / gleitender Hover-Indikator — konzentrisch zur Pill */
export const profileDockActiveBgClassName = "bg-black/6 dark:bg-white/10";

export const profileDockHighlightClassName = "rounded-[1.375rem]";

export const profileDockIconButtonClassName = cn(
  "relative z-10 flex shrink-0 items-center justify-center rounded-[1.375rem] text-foreground/80 transition-colors active:scale-95",
);

/** Tooltip über dem Start-Dock — Glas, passend zur Kapsel (ohne Pfeil) */
export const profileDockTooltipContentClassName = cn(
  "!rounded-xl !border !border-white/30 !bg-white/85 !px-2.5 !py-1 !text-[11px] !font-medium !text-foreground !shadow-lg backdrop-blur-md",
  "dark:!border-white/20 dark:!bg-black/75 dark:!text-foreground",
  "data-open:fade-in-0 data-open:slide-in-from-bottom-1 data-closed:fade-out-0",
);
