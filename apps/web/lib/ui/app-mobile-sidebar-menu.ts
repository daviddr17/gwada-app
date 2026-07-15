/** Mobile Vollbild-Menü (Sidebar-Overlay): Module als Kacheln, Footer volle Breite. */

export const appMobileSidebarGroupClassName = "px-3 py-2";

/** Wrapper um Modul-Listen — 2-spaltiges Kachel-Grid + größere Touch-Targets. */
export const appMobileSidebarModuleGroupContentClassName = [
  "[&_[data-sidebar=menu]]:grid [&_[data-sidebar=menu]]:grid-cols-2 [&_[data-sidebar=menu]]:gap-2",
  "[&_[data-sidebar=menu-item]]:min-w-0",
  "[&_[data-sidebar=menu-button]]:flex [&_[data-sidebar=menu-button]]:min-h-[4.75rem] [&_[data-sidebar=menu-button]]:w-full [&_[data-sidebar=menu-button]]:flex-col [&_[data-sidebar=menu-button]]:items-center [&_[data-sidebar=menu-button]]:justify-center [&_[data-sidebar=menu-button]]:gap-1.5 [&_[data-sidebar=menu-button]]:rounded-xl [&_[data-sidebar=menu-button]]:border [&_[data-sidebar=menu-button]]:border-transparent [&_[data-sidebar=menu-button]]:px-2 [&_[data-sidebar=menu-button]]:py-3 [&_[data-sidebar=menu-button]]:text-center [&_[data-sidebar=menu-button]]:text-sm [&_[data-sidebar=menu-button]]:font-medium",
  "[&_[data-sidebar=menu-button]_svg]:!col-auto [&_[data-sidebar=menu-button]_svg]:!row-auto [&_[data-sidebar=menu-button]_svg]:size-6 [&_[data-sidebar=menu-button]_svg]:place-self-center",
  "[&_[data-sidebar=menu-button]>span:last-child]:!col-auto [&_[data-sidebar=menu-button]>span:last-child]:!row-auto [&_[data-sidebar=menu-button]>span:last-child]:max-w-full [&_[data-sidebar=menu-button]>span:last-child]:line-clamp-2 [&_[data-sidebar=menu-button]>span:last-child]:text-xs [&_[data-sidebar=menu-button]>span:last-child]:leading-snug [&_[data-sidebar=menu-button]>span:last-child]:whitespace-normal [&_[data-sidebar=menu-button]>span:last-child]:text-balance",
  "[&_[data-sidebar=menu-button][data-active]]:border-border/50 [&_[data-sidebar=menu-button][data-active]]:bg-sidebar-accent [&_[data-sidebar=menu-button][data-active]]:shadow-xs",
].join(" ");

export const appMobileSidebarFooterMenuClassName = "gap-2 px-3 pb-2";

export const appMobileSidebarFooterMenuButtonClassName =
  "min-h-11 rounded-xl text-[15px] [&_svg]:size-5";

export const appMobileSidebarHeaderButtonClassName =
  "min-h-14 rounded-xl px-3 py-2.5 [&_svg]:size-5";
