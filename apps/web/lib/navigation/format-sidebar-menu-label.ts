/** Sidebar-Label mit optionaler Anzahl in Klammern, z. B. „Changelog (3)“. */
export function formatSidebarMenuLabel(label: string, count: number): string {
  if (count <= 0) return label;
  const shown = count > 99 ? "99+" : String(count);
  return `${label} (${shown})`;
}
