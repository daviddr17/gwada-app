/** Sidebar-Modul „Aufgaben“ (persönlich, Team-ToDos, Team-Chat, Protokoll). */
export const CHECKLISTEN_ROUTES = {
  root: "/dashboard/tasks",
  meine: "/dashboard/tasks/mine",
  team: "/dashboard/tasks",
  nachrichten: "/dashboard/tasks/messages",
  /** Legacy bookmark — redirects to Team root. */
  eigenkontrolle: "/dashboard/tasks/eigenkontrolle",
  todos: "/dashboard/tasks/todos",
  vorlagen: "/dashboard/tasks/templates",
  geraete: "/dashboard/tasks/devices",
  eintraege: "/dashboard/tasks/entries",
  protokoll: "/dashboard/tasks/log",
  einstellungen: "/dashboard/tasks/settings",
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
