/**
 * Nachrichten Desktop-Split: exakt die Scrollport-Höhe, kein Seiten-Scroll
 * unter dem Split.
 *
 * Kein `100dvh`-Calc: Sidebar `variant="inset"` hat ab md `mb-2`, Header und
 * Chip-Strip liegen außerhalb des Scroll-Roots — `h-full` füllt genau den Rest.
 * `flex-1` allein kollabiert, solange Keep-alive/`z-[1]` nur `min-h-full` haben.
 */

/** Keep-alive-Slot: auf lg Höhe des Scroll-Roots, intern clippen. */
export const messagesInboxDesktopKeepAliveSlotClassName =
  "lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden lg:overscroll-none";

export const messagesInboxDesktopRootClassName =
  "min-h-full lg:flex lg:h-full lg:max-h-full lg:min-h-0 lg:flex-col lg:overflow-hidden lg:overscroll-none";

/** `AppMain` hat sonst ab md `pb-16` — erzeugt Scroll-Leerraum unter dem Split. */
export const messagesInboxDesktopMainClassName =
  "flex h-full min-h-0 flex-col overflow-hidden md:pb-0 lg:pb-2 lg:pt-2";

export const messagesInboxDesktopMainWrapperClassName =
  "flex h-full min-h-0 flex-1 flex-col";

export const messagesInboxDesktopScreenClassName =
  "lg:flex lg:h-full lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-3 lg:overflow-hidden lg:pt-1";
