"use client"

import * as React from "react"

/**
 * DOM node inside {@link DrawerContent} used as Floating UI `container` for Select /
 * Combobox portals. Radix Dialog (used by Vaul) sets `disableOutsidePointerEvents` on
 * modal content, so popups portaled to `document.body` never receive clicks — they must
 * mount inside this host instead.
 */
export const DrawerFloatingPortalContext =
  React.createContext<React.RefObject<HTMLDivElement | null> | null>(null)

export function useDrawerFloatingPortalHost(): HTMLDivElement | null {
  const hostRef = React.useContext(DrawerFloatingPortalContext)
  return hostRef?.current ?? null
}
