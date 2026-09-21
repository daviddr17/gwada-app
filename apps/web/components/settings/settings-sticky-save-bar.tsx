"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import {
  appContentPxClassName,
  appMobileStickyAboveBottomNavClassName,
} from "@/lib/ui/app-mobile-bottom-nav"
import { APP_LAYER_Z_INDEX } from "@/lib/ui/app-layer-z-index"
import { getAppChromeFooterHost } from "@/lib/layout/app-scroll-root"
import { cn } from "@/lib/utils"
export {
  brandActionButtonClassName,
  brandActionButtonRoundedClassName,
  settingsAccentSaveButtonClassName,
} from "@/lib/ui/brand-action-button"

const SAVE_BAR_SPACER_CLASS = "pointer-events-none h-[4.75rem] shrink-0"

const saveBarSurfaceClassName = cn(
  "border-t border-border/60 bg-background/85 py-3 backdrop-blur-md supports-backdrop-filter:bg-background/75",
  "shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.08)] dark:border-border/40 dark:shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.45)]",
  appContentPxClassName,
  "pb-[max(0.75rem,var(--app-mobile-bottom-safe))]",
)

/**
 * Speichern-Leiste bei ungespeicherten Änderungen.
 * Portiert in den Chrome-Footer (über Scroll-Root) — bleibt unten, scrollt nicht mit.
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
  const [footerHost, setFooterHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setFooterHost(getAppChromeFooterHost())
  }, [])

  if (!show) return null

  const bar = (
    <div
      data-settings-sticky-save-bar
      role="region"
      aria-label="Ungespeicherte Änderungen"
      style={{
        zIndex: APP_LAYER_Z_INDEX.mobileBottomNav + 1,
      }}
      className={cn(
        saveBarSurfaceClassName,
        footerHost
          ? cn(
              "pointer-events-auto absolute inset-x-0",
              appMobileStickyAboveBottomNavClassName,
              "md:bottom-0",
              className,
            )
          : cn(
              "sticky bottom-0 z-30 mt-8 -mx-4 sm:-mx-6",
              appMobileStickyAboveBottomNavClassName,
              "md:bottom-0",
              className,
            ),
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {children}
      </div>
    </div>
  )

  return (
    <>
      <div className={SAVE_BAR_SPACER_CLASS} aria-hidden />
      {footerHost ? createPortal(bar, footerHost) : bar}
    </>
  )
}
