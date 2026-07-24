/** Mobile Vollbild-Menü (Sidebar-Overlay): Module als Kacheln,
 * Secondary-Aktionen als Tab-Leiste (wie Bottom-Nav) darüber.
 */

/** Symmetrische Außenabstände fürs Modul-Grid (p-2 der SidebarGroup überschreiben). */
export const appMobileSidebarGroupClassName = "!px-3 !py-1.5";

/** Wrapper um Modul-Listen — 3-spaltiges Kachel-Grid, zentriert/symmetrisch. */
export const appMobileSidebarModuleGroupContentClassName = [
  "w-full",
  "[&_[data-sidebar=menu]]:mx-auto [&_[data-sidebar=menu]]:grid [&_[data-sidebar=menu]]:w-full [&_[data-sidebar=menu]]:grid-cols-3 [&_[data-sidebar=menu]]:gap-2",
  "[&_[data-sidebar=menu-item]]:min-w-0 [&_[data-sidebar=menu-item]]:w-full",
  // Rail-Defaults (h-8, grid, overflow-hidden, truncate) für Kacheln zurücknehmen.
  "[&_[data-sidebar=menu-button]]:!flex [&_[data-sidebar=menu-button]]:!h-auto [&_[data-sidebar=menu-button]]:min-h-[3.75rem] [&_[data-sidebar=menu-button]]:w-full [&_[data-sidebar=menu-button]]:flex-col [&_[data-sidebar=menu-button]]:items-center [&_[data-sidebar=menu-button]]:justify-center [&_[data-sidebar=menu-button]]:gap-1.5 [&_[data-sidebar=menu-button]]:overflow-visible [&_[data-sidebar=menu-button]]:rounded-xl [&_[data-sidebar=menu-button]]:border [&_[data-sidebar=menu-button]]:border-transparent [&_[data-sidebar=menu-button]]:px-1.5 [&_[data-sidebar=menu-button]]:py-2.5 [&_[data-sidebar=menu-button]]:text-center [&_[data-sidebar=menu-button]]:text-sm [&_[data-sidebar=menu-button]]:font-medium",
  "[&_[data-sidebar=menu-button]_svg]:!col-auto [&_[data-sidebar=menu-button]_svg]:!row-auto [&_[data-sidebar=menu-button]_svg]:size-6 [&_[data-sidebar=menu-button]_svg]:shrink-0 [&_[data-sidebar=menu-button]_svg]:place-self-center",
  "[&_[data-sidebar=menu-button]>span:last-child]:!col-auto [&_[data-sidebar=menu-button]>span:last-child]:!row-auto [&_[data-sidebar=menu-button]>span:last-child]:max-w-full [&_[data-sidebar=menu-button]>span:last-child]:[text-overflow:clip] [&_[data-sidebar=menu-button]>span:last-child]:hyphens-auto [&_[data-sidebar=menu-button]>span:last-child]:break-words [&_[data-sidebar=menu-button]>span:last-child]:whitespace-normal [&_[data-sidebar=menu-button]>span:last-child]:text-balance [&_[data-sidebar=menu-button]>span:last-child]:text-xs [&_[data-sidebar=menu-button]>span:last-child]:leading-snug [&_[data-sidebar=menu-button]>span:last-child]:line-clamp-2",
  "[&_[data-sidebar=menu-button][data-active]]:border-border/50 [&_[data-sidebar=menu-button][data-active]]:bg-sidebar-accent [&_[data-sidebar=menu-button][data-active]]:shadow-xs",
  // Skeletons wie Modul-Kacheln.
  "[&_[data-sidebar=menu-skeleton]]:ms-0 [&_[data-sidebar=menu-skeleton]]:flex [&_[data-sidebar=menu-skeleton]]:h-auto [&_[data-sidebar=menu-skeleton]]:min-h-[3.75rem] [&_[data-sidebar=menu-skeleton]]:w-full [&_[data-sidebar=menu-skeleton]]:flex-col [&_[data-sidebar=menu-skeleton]]:items-center [&_[data-sidebar=menu-skeleton]]:justify-center [&_[data-sidebar=menu-skeleton]]:gap-1.5 [&_[data-sidebar=menu-skeleton]]:rounded-xl [&_[data-sidebar=menu-skeleton]]:px-1.5 [&_[data-sidebar=menu-skeleton]]:py-2.5",
  "[&_[data-sidebar=menu-skeleton-icon]]:!size-6",
  "[&_[data-sidebar=menu-skeleton-text]]:!h-2.5 [&_[data-sidebar=menu-skeleton-text]]:!w-[75%] [&_[data-sidebar=menu-skeleton-text]]:!flex-none [&_[data-sidebar=menu-skeleton-text]]:!max-w-[5rem]",
].join(" ");

/**
 * Secondary-Leiste wie Bottom-Nav: eine Zeile, gleiche Flex-Spalten,
 * randlos unter den Modulen / über der sticky Footer-Nav.
 */
export const appMobileSidebarFooterClassName =
  "gap-0 border-t border-border/50 p-0";

/** Höhe wie Bottom-Nav (`APP_MOBILE_BOTTOM_NAV_BAR_H` = 3.5rem → h-14). */
export const appMobileSidebarFooterMenuClassName = [
  "!flex h-14 w-full min-w-0 flex-row items-stretch gap-0 px-0",
  "[&_[data-sidebar=menu-item]]:flex [&_[data-sidebar=menu-item]]:h-full [&_[data-sidebar=menu-item]]:min-w-0 [&_[data-sidebar=menu-item]]:flex-1",
].join(" ");

export const appMobileSidebarFooterMenuButtonClassName = [
  "!flex !h-full min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-none border-0 px-1 py-0 text-center text-[10px] font-medium text-muted-foreground shadow-none",
  "hover:!bg-transparent hover:text-foreground active:!bg-transparent",
  "data-active:!bg-transparent data-active:font-medium data-active:!text-foreground",
  "[&_svg]:!col-auto [&_svg]:!row-auto [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:place-self-center",
  "[&>span:last-child]:!col-auto [&>span:last-child]:!row-auto [&>span:last-child]:max-w-full [&>span:last-child]:truncate [&>span:last-child]:whitespace-nowrap [&>span:last-child]:text-[10px] [&>span:last-child]:leading-tight",
].join(" ");

export const appMobileSidebarHeaderButtonClassName =
  "min-h-12 rounded-xl px-2.5 py-2 [&_svg]:size-5";
