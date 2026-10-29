/** Superadmin: zentrale Vorlagen-Bibliothek */
export const SUPERADMIN_VORLAGEN_ROUTES = {
  root: "/superadmin/templates",
  vertragsvorlagen: "/superadmin/templates/contract-templates",
  kennzeichnungen: "/superadmin/templates/food-markings",
} as const;

export const SUPERADMIN_VORLAGEN_NAV = [
  {
    href: SUPERADMIN_VORLAGEN_ROUTES.vertragsvorlagen,
    label: "Vertragsvorlagen",
    matchMode: "prefix" as const,
  },
  {
    href: SUPERADMIN_VORLAGEN_ROUTES.kennzeichnungen,
    label: "Allergene & Zusatzstoffe",
    matchMode: "prefix" as const,
  },
];
