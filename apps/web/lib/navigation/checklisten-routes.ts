/** Sidebar-Modul „Checklisten“ (ToDo-Listen + Eigenkontrolle). */
export const CHECKLISTEN_ROUTES = {
  root: "/dashboard/checklisten",
  todos: "/dashboard/checklisten/todos",
  vorlagen: "/dashboard/checklisten/vorlagen",
  geraete: "/dashboard/checklisten/geraete",
  eintraege: "/dashboard/checklisten/eintraege",
  protokoll: "/dashboard/checklisten/protokoll",
  einstellungen: "/dashboard/checklisten/einstellungen",
} as const;

export const CHECKLISTEN_NAV = [
  {
    href: CHECKLISTEN_ROUTES.root,
    label: "Übersicht",
    matchMode: "prefix" as const,
    activeWhen: [CHECKLISTEN_ROUTES.root, CHECKLISTEN_ROUTES.todos],
  },
  {
    href: CHECKLISTEN_ROUTES.protokoll,
    label: "Protokoll",
    matchMode: "prefix" as const,
  },
  {
    href: CHECKLISTEN_ROUTES.einstellungen,
    label: "Einstellungen",
    matchMode: "prefix" as const,
  },
];
