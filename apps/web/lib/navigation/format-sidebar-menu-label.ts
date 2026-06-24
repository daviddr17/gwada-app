/** Sidebar-Label mit optionaler Anzahl in Klammern, z. B. „Kontakte (3)“. */
export function formatSidebarMenuLabel(label: string, count: number): string {
  if (count <= 0) return label;
  const shown = formatSidebarNotificationCount(count);
  return shown ? `${label} (${shown})` : label;
}

/** Anzeige-Zähler für Klammern im Sidebar-Label — null wenn 0. */
export function formatSidebarNotificationCount(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}
