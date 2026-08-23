"use client"

import type { ReactNode } from "react"

import {
  appMobileStickyAboveBottomNavClassName,
} from "@/lib/ui/app-mobile-bottom-nav"
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index"
import { cn } from "@/lib/utils"
export {
  brandActionButtonClassName,
  brandActionButtonRoundedClassName,
  settingsAccentSaveButtonClassName,
} from "@/lib/ui/brand-action-button"

/**
 * Speichern-Leiste bei ungespeicherten Änderungen.
 * Mobil: `fixed` über der Bottom-Nav (sticky mid-page wenn Formular kurz).
 * Desktop: sticky im Scroll-Container.
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
    <>
      {/* Platzhalter: Inhalt nicht unter der fixed Bar verstecken */}
      <div
        className="pointer-events-none max-lg:h-[4.75rem] lg:hidden"
        aria-hidden
      />
      <div
        data-settings-sticky-save-bar
        role="region"
        aria-label="Ungespeicherte Änderungen"
        style={{
          // Über Bottom-Nav (140), unter Drawer/Fullscreen (200+)
          zIndex: APP_LAYER_Z_INDEX.mobileBottomNav + 1,
        }}
        className={cn(
          "border-t border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-background/75 sm:px-6",
          "shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.08)] dark:border-border/40 dark:shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.45)]",
          // Mobil: fest über Bottom-Nav (nicht mid-page sticky bei kurzem Formular)
          "max-lg:fixed max-lg:inset-x-0",
          appMobileStickyAboveBottomNavClassName,
          // Desktop: sticky am Scroll-Ende (AppMain sm:px-6)
          "lg:sticky lg:bottom-0 lg:z-30 lg:mt-8 lg:-mx-6 lg:pb-[max(0.75rem,var(--app-mobile-bottom-safe))]",
          className,
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {children}
        </div>
      </div>
    </>
  )
}
