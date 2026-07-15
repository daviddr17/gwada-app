"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
export {
  brandActionButtonClassName,
  brandActionButtonRoundedClassName,
  settingsAccentSaveButtonClassName,
} from "@/lib/ui/brand-action-button"

/**
 * Sticky unten im Scrollbereich der App, wenn Formulardaten geändert wurden.
 * Liegt im `AppMain`-Scroll-Container (`data-app-scroll-root`).
 */
export function SettingsStickySaveBar({
  show,
  children,
  className,
}: {
  show: boolean
  children: ReactNode
  className?: string
}) {
  if (!show) return null

  return (
    <div
      role="region"
      aria-label="Ungespeicherte Änderungen"
      className={cn(
        "sticky bottom-0 z-30 mt-8 -mx-4 border-t border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-background/75 sm:-mx-6 sm:px-6",
        "shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.08)] dark:border-border/40 dark:shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.45)]",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "max-md:bottom-[calc(var(--app-mobile-bottom-nav-bar)+env(safe-area-inset-bottom,0px))]",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {children}
      </div>
    </div>
  )
}
