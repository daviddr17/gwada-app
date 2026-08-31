/** Sidebar-Modul „Aufgaben“ (persönlich, Team-ToDos, Team-Chat, Eigenkontrolle). */
export const CHECKLISTEN_ROUTES = {
  root: "/dashboard/checklisten",
  meine: "/dashboard/checklisten/meine",
  team: "/dashboard/checklisten",
  nachrichten: "/dashboard/checklisten/nachrichten",
  eigenkontrolle: "/dashboard/checklisten/eigenkontrolle",
  todos: "/dashboard/checklisten/todos",
  vorlagen: "/dashboard/checklisten/vorlagen",
  geraete: "/dashboard/checklisten/geraete",
  eintraege: "/dashboard/checklisten/eintraege",
  protokoll: "/dashboard/checklisten/protokoll",
  einstellungen: "/dashboard/checklisten/einstellungen",
} as const;

export const CHECKLISTEN_NAV = [
  {
    href: CHECKLISTEN_ROUTES.meine,
    label: "Meine",
    matchMode: "prefix" as const,
  },
  {
    href: CHECKLISTEN_ROUTES.team,
    label: "Team",
    matchMode: "exact" as const,
    activeWhen: [CHECKLISTEN_ROUTES.root, CHECKLISTEN_ROUTES.todos],
  },
  {
    href: CHECKLISTEN_ROUTES.nachrichten,
    label: "Nachrichten",
    matchMode: "prefix" as const,
  },
  {
    href: CHECKLISTEN_ROUTES.eigenkontrolle,
    label: "Eigenkontrolle",
    matchMode: "prefix" as const,
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
