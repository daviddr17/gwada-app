import { cn } from "@/lib/utils";

/** Scroll-Root: Höhe des Drag-Handle-Streifens (Name/Modul kleben darunter). */
export const PROFILE_SHEET_HANDLE_HEIGHT_VAR = "--profile-sheet-handle-h";

/** Scroll-Root: Handle + Name/Modul ohne Logo (Toolbar klebt darunter). */
export const PROFILE_SHEET_HEADER_HEIGHT_VAR = "--profile-sheet-header-h";

/** Bottom-Sheet-Chrome — auf Touch ohne backdrop-filter (Safari/iOS). */
export function profileAppSheetClassName(lightEffects = false) {
  return cn(
    "fixed z-[60] flex flex-col overflow-hidden",
    "top-[max(3.5rem,env(safe-area-inset-top))]",
    "bottom-[max(5.5rem,env(safe-area-inset-bottom))]",
    "left-0 right-0 mx-auto w-[calc(100%-1.5rem)] md:w-[60vw]",
    "border border-white/25 dark:border-white/10",
    lightEffects
      ? "bg-background shadow-[0_20px_64px_-16px_rgba(0,0,0,0.35)] dark:shadow-[0_20px_64px_-16px_rgba(0,0,0,0.55)]"
      : cn(
          "bg-background/95 backdrop-blur-2xl",
          "shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)]",
        ),
  );
}
