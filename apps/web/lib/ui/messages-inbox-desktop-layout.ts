/** Nachrichten Desktop-Split: exakt Scrollport-Höhe, kein Seiten-Whitespace darunter. */
export const messagesInboxDesktopRootClassName =
  "min-h-full lg:flex lg:h-[calc(100dvh-var(--app-chrome-header-h)-var(--app-module-chip-sticky-h,0px))] lg:max-h-[calc(100dvh-var(--app-chrome-header-h)-var(--app-module-chip-sticky-h,0px))] lg:min-h-0 lg:flex-col lg:overflow-hidden";

/** `AppMain` hat sonst ab md `pb-16` — erzeugt endlosen Scroll-Leerraum unter dem Split. */
export const messagesInboxDesktopMainClassName =
  "h-full min-h-0 overflow-hidden md:pb-0 lg:pt-2";

export const messagesInboxDesktopMainWrapperClassName =
  "h-full min-h-0 lg:flex lg:flex-1 lg:flex-col";

export const messagesInboxDesktopScreenClassName =
  "lg:h-full lg:min-h-0 lg:flex lg:flex-col lg:gap-3 lg:overflow-hidden lg:pt-1";
