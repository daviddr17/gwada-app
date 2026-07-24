/** Mobile Vollbild-Menü (Sidebar-Overlay): Module als Kacheln, Footer volle Breite.
 * 3 Spalten + kompakte Kacheln — App und Superadmin (gleiche Sidebar) ohne Scroll
 * auf typischen Phone-Höhen (~667–844).
 */

export const appMobileSidebarGroupClassName = "px-2.5 py-1.5";

/** Wrapper um Modul-Listen — 3-spaltiges Kachel-Grid, passt ohne Scroll. */
export const appMobileSidebarModuleGroupContentClassName = [
  "[&_[data-sidebar=menu]]:grid [&_[data-sidebar=menu]]:grid-cols-3 [&_[data-sidebar=menu]]:gap-1.5",
  "[&_[data-sidebar=menu-item]]:min-w-0",
  "[&_[data-sidebar=menu-button]]:flex [&_[data-sidebar=menu-button]]:min-h-[3.25rem] [&_[data-sidebar=menu-button]]:w-full [&_[data-sidebar=menu-button]]:flex-col [&_[data-sidebar=menu-button]]:items-center [&_[data-sidebar=menu-button]]:justify-center [&_[data-sidebar=menu-button]]:gap-1 [&_[data-sidebar=menu-button]]:rounded-xl [&_[data-sidebar=menu-button]]:border [&_[data-sidebar=menu-button]]:border-transparent [&_[data-sidebar=menu-button]]:px-1.5 [&_[data-sidebar=menu-button]]:py-2 [&_[data-sidebar=menu-button]]:text-center [&_[data-sidebar=menu-button]]:text-sm [&_[data-sidebar=menu-button]]:font-medium",
  "[&_[data-sidebar=menu-button]_svg]:!col-auto [&_[data-sidebar=menu-button]_svg]:!row-auto [&_[data-sidebar=menu-button]_svg]:size-5 [&_[data-sidebar=menu-button]_svg]:place-self-center",
  "[&_[data-sidebar=menu-button]>span:last-child]:!col-auto [&_[data-sidebar=menu-button]>span:last-child]:!row-auto [&_[data-sidebar=menu-button]>span:last-child]:max-w-full [&_[data-sidebar=menu-button]>span:last-child]:line-clamp-2 [&_[data-sidebar=menu-button]>span:last-child]:text-[11px] [&_[data-sidebar=menu-button]>span:last-child]:leading-snug [&_[data-sidebar=menu-button]>span:last-child]:whitespace-normal [&_[data-sidebar=menu-button]>span:last-child]:text-balance",
  "[&_[data-sidebar=menu-button][data-active]]:border-border/50 [&_[data-sidebar=menu-button][data-active]]:bg-sidebar-accent [&_[data-sidebar=menu-button][data-active]]:shadow-xs",
  // Skeletons wie Modul-Kacheln (sonst flache Rail-Zeile in schmaler Grid-Zelle → abgeschnitten).
  "[&_[data-sidebar=menu-skeleton]]:ms-0 [&_[data-sidebar=menu-skeleton]]:flex [&_[data-sidebar=menu-skeleton]]:h-auto [&_[data-sidebar=menu-skeleton]]:min-h-[3.25rem] [&_[data-sidebar=menu-skeleton]]:w-full [&_[data-sidebar=menu-skeleton]]:flex-col [&_[data-sidebar=menu-skeleton]]:items-center [&_[data-sidebar=menu-skeleton]]:justify-center [&_[data-sidebar=menu-skeleton]]:gap-1.5 [&_[data-sidebar=menu-skeleton]]:rounded-xl [&_[data-sidebar=menu-skeleton]]:px-1.5 [&_[data-sidebar=menu-skeleton]]:py-2",
  "[&_[data-sidebar=menu-skeleton-icon]]:!size-5",
  "[&_[data-sidebar=menu-skeleton-text]]:!h-2 [&_[data-sidebar=menu-skeleton-text]]:!w-[70%] [&_[data-sidebar=menu-skeleton-text]]:!flex-none [&_[data-sidebar=menu-skeleton-text]]:!max-w-[4.5rem]",
].join(" ");

export const appMobileSidebarFooterMenuClassName = "gap-1.5 px-2.5 pb-1.5";

export const appMobileSidebarFooterMenuButtonClassName =
  "min-h-10 rounded-xl text-sm [&_svg]:size-4";

export const appMobileSidebarHeaderButtonClassName =
  "min-h-12 rounded-xl px-2.5 py-2 [&_svg]:size-5";
