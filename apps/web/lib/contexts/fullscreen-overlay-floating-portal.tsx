"use client";

import * as React from "react";

/** DOM-Knoten in {@link AppFullscreenOverlay} — Portal-Ziel für Tooltips im Vollbild. */
export const FullscreenOverlayFloatingPortalContext =
  React.createContext<HTMLDivElement | null>(null);

export function useFullscreenOverlayFloatingPortalHost() {
  return React.useContext(FullscreenOverlayFloatingPortalContext);
}
