/** Superadmin: zentrale Vorlagen-Bibliothek */
export const SUPERADMIN_VORLAGEN_ROUTES = {
  root: "/superadmin/vorlagen",
  vertragsvorlagen: "/superadmin/vorlagen/vertragsvorlagen",
} as const;

export const SUPERADMIN_VORLAGEN_NAV = [
  {
    href: SUPERADMIN_VORLAGEN_ROUTES.vertragsvorlagen,
    label: "Vertragsvorlagen",
    matchMode: "prefix" as const,
  },
];
