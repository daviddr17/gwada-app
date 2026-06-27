/** Superadmin: zentrale Vorlagen-Bibliothek */
export const SUPERADMIN_VORLAGEN_ROUTES = {
  root: "/superadmin/vorlagen",
  vertragsvorlagen: "/superadmin/vorlagen/vertragsvorlagen",
  checklisten: "/superadmin/vorlagen/checklisten",
} as const;

export const SUPERADMIN_VORLAGEN_NAV = [
  {
    href: SUPERADMIN_VORLAGEN_ROUTES.vertragsvorlagen,
    label: "Vertragsvorlagen",
    matchMode: "prefix" as const,
  },
  {
    href: SUPERADMIN_VORLAGEN_ROUTES.checklisten,
    label: "Checklisten-Vorlagen",
    matchMode: "prefix" as const,
  },
];
