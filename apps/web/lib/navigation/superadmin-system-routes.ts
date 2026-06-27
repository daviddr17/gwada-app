/** Superadmin: technische System-Einstellungen */
export const SUPERADMIN_SYSTEM_ROUTES = {
  datenbank: "/superadmin/datenbank",
  ladeStrategie: "/superadmin/lade-strategie",
} as const;

export const SUPERADMIN_SYSTEM_NAV = [
  {
    href: SUPERADMIN_SYSTEM_ROUTES.datenbank,
    label: "Datenbank",
    matchMode: "prefix" as const,
  },
  {
    href: SUPERADMIN_SYSTEM_ROUTES.ladeStrategie,
    label: "Lade-Strategie",
    matchMode: "prefix" as const,
  },
];

export function isSuperadminSystemPath(pathname: string): boolean {
  return (
    pathname.startsWith(SUPERADMIN_SYSTEM_ROUTES.datenbank) ||
    pathname.startsWith(SUPERADMIN_SYSTEM_ROUTES.ladeStrategie)
  );
}
