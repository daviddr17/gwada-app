/** Feste App-Chrome-Zonen: Sidebar-Kopf/-Fuß, Top-Header. */
export const appChromeFixedZoneBgClassName = "bg-app-chrome-fixed-zone";

/** Header-Start: 1rem, plus Safe-Area (viewport-fit: cover). */
export const appChromeSafeStartClassName =
  "ps-[max(1rem,env(safe-area-inset-left,0px))]";

/** Header-Ende: bisher pe-3 / sm:pe-6, plus Safe-Area. */
export const appChromeSafeEndClassName =
  "pe-[max(0.75rem,env(safe-area-inset-right,0px))] sm:pe-[max(1.5rem,env(safe-area-inset-right,0px))]";
