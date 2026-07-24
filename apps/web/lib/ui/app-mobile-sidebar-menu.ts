/** Mobile Vollbild-Menü (Sidebar-Overlay): Module als Kacheln, Footer 2×2.
 * App und Superadmin (gleiche Sidebar) — Footer kompakt, Module lesbar ohne
 * abgeschnittene Labels auf typischen Phone-Höhen (~667–844).
 */

export const appMobileSidebarGroupClassName = "px-2.5 py-1.5";

/** Wrapper um Modul-Listen — 3-spaltiges Kachel-Grid. */
export const appMobileSidebarModuleGroupContentClassName = [
  "[&_[data-sidebar=menu]]:grid [&_[data-sidebar=menu]]:grid-cols-3 [&_[data-sidebar=menu]]:gap-2",
  "[&_[data-sidebar=menu-item]]:min-w-0",
  // Rail-Defaults (h-8, grid, overflow-hidden, truncate) für Kacheln zurücknehmen.
  "[&_[data-sidebar=menu-button]]:!flex [&_[data-sidebar=menu-button]]:!h-auto [&_[data-sidebar=menu-button]]:min-h-[3.75rem] [&_[data-sidebar=menu-button]]:w-full [&_[data-sidebar=menu-button]]:flex-col [&_[data-sidebar=menu-button]]:items-center [&_[data-sidebar=menu-button]]:justify-center [&_[data-sidebar=menu-button]]:gap-1.5 [&_[data-sidebar=menu-button]]:overflow-visible [&_[data-sidebar=menu-button]]:rounded-xl [&_[data-sidebar=menu-button]]:border [&_[data-sidebar=menu-button]]:border-transparent [&_[data-sidebar=menu-button]]:px-2 [&_[data-sidebar=menu-button]]:py-2.5 [&_[data-sidebar=menu-button]]:text-center [&_[data-sidebar=menu-button]]:text-sm [&_[data-sidebar=menu-button]]:font-medium",
  "[&_[data-sidebar=menu-button]_svg]:!col-auto [&_[data-sidebar=menu-button]_svg]:!row-auto [&_[data-sidebar=menu-button]_svg]:size-6 [&_[data-sidebar=menu-button]_svg]:shrink-0 [&_[data-sidebar=menu-button]_svg]:place-self-center",
  "[&_[data-sidebar=menu-button]>span:last-child]:!col-auto [&_[data-sidebar=menu-button]>span:last-child]:!row-auto [&_[data-sidebar=menu-button]>span:last-child]:max-w-full [&_[data-sidebar=menu-button]>span:last-child]:[text-overflow:clip] [&_[data-sidebar=menu-button]>span:last-child]:hyphens-auto [&_[data-sidebar=menu-button]>span:last-child]:break-words [&_[data-sidebar=menu-button]>span:last-child]:whitespace-normal [&_[data-sidebar=menu-button]>span:last-child]:text-balance [&_[data-sidebar=menu-button]>span:last-child]:text-xs [&_[data-sidebar=menu-button]>span:last-child]:leading-snug [&_[data-sidebar=menu-button]>span:last-child]:line-clamp-2",
  "[&_[data-sidebar=menu-button][data-active]]:border-border/50 [&_[data-sidebar=menu-button][data-active]]:bg-sidebar-accent [&_[data-sidebar=menu-button][data-active]]:shadow-xs",
  // Skeletons wie Modul-Kacheln (sonst flache Rail-Zeile in schmaler Grid-Zelle → abgeschnitten).
  "[&_[data-sidebar=menu-skeleton]]:ms-0 [&_[data-sidebar=menu-skeleton]]:flex [&_[data-sidebar=menu-skeleton]]:h-auto [&_[data-sidebar=menu-skeleton]]:min-h-[3.75rem] [&_[data-sidebar=menu-skeleton]]:w-full [&_[data-sidebar=menu-skeleton]]:flex-col [&_[data-sidebar=menu-skeleton]]:items-center [&_[data-sidebar=menu-skeleton]]:justify-center [&_[data-sidebar=menu-skeleton]]:gap-1.5 [&_[data-sidebar=menu-skeleton]]:rounded-xl [&_[data-sidebar=menu-skeleton]]:px-2 [&_[data-sidebar=menu-skeleton]]:py-2.5",
  "[&_[data-sidebar=menu-skeleton-icon]]:!size-6",
  "[&_[data-sidebar=menu-skeleton-text]]:!h-2.5 [&_[data-sidebar=menu-skeleton-text]]:!w-[75%] [&_[data-sidebar=menu-skeleton-text]]:!flex-none [&_[data-sidebar=menu-skeleton-text]]:!max-w-[5rem]",
].join(" ");

/** Footer: 2×2 statt hoher Liste — spart Höhe für größere Module. */
export const appMobileSidebarFooterMenuClassName = [
  "!grid grid-cols-2 gap-1.5 px-2.5 pb-2",
  "[&_[data-sidebar=menu-item]]:min-w-0",
].join(" ");

export const appMobileSidebarFooterMenuButtonClassName = [
  "!flex !h-auto min-h-[2.75rem] w-full flex-col items-center justify-center gap-0.5 overflow-visible rounded-xl px-2 py-1.5 text-center text-xs font-medium",
  "[&_svg]:!col-auto [&_svg]:!row-auto [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:place-self-center",
  "[&>span:last-child]:!col-auto [&>span:last-child]:!row-auto [&>span:last-child]:max-w-full [&>span:last-child]:truncate [&>span:last-child]:whitespace-nowrap [&>span:last-child]:text-[11px] [&>span:last-child]:leading-tight",
].join(" ");

export const appMobileSidebarHeaderButtonClassName =
  "min-h-12 rounded-xl px-2.5 py-2 [&_svg]:size-5";
