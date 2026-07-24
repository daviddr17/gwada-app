/**
 * Zentrale Registry für Lade- und Cache-Strategien pro Datenbereich.
 * Superadmin → „Lade- & Cache-Strategie“ visualisiert diese Datei.
 * Bei neuen Modulen: Eintrag ergänzen, Konstanten hierher ziehen, UI zeigt den Stand.
 */
export type ModuleCacheStrategy =
  | "optimistic-local"
  | "stale-while-revalidate"
  | "realtime"
  | "poll"
  | "batch-api";

export type ModuleCacheScope =
  | "dashboard"
  | "chrome"
  | "module"
  | "platform";

export type ModuleCachePolicyStatus = "active" | "planned" | "legacy";

export type ModuleCachePolicyEntry = {
  id: string;
  label: string;
  scope: ModuleCacheScope;
  /** App-Modul (Sidebar), falls zutreffend */
  appModule?: string;
  strategy: ModuleCacheStrategy;
  staleTimeMs?: number;
  pollIntervalMs?: number;
  gcTimeMs?: number;
  description: string;
  loadTriggers: string[];
  invalidateTriggers: string[];
  apiEndpoints?: string[];
  implementationFiles: string[];
  status: ModuleCachePolicyStatus;
  notes?: string;
};

export type ModuleCacheStrategyMeta = {
  label: string;
  shortLabel: string;
  colorClass: string;
  whenToUse: string;
};

export const MODULE_CACHE_STRATEGY_META: Record<
  ModuleCacheStrategy,
  ModuleCacheStrategyMeta
> = {
  "optimistic-local": {
    label: "Optimistisch (localStorage)",
    shortLabel: "LS sofort",
    colorClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    whenToUse:
      "UI-relevante Prefs ohne Server-Roundtrip — sofort rendern, DB im Hintergrund abgleichen.",
  },
  "stale-while-revalidate": {
    label: "Stale-while-revalidate",
    shortLabel: "SWR",
    colorClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    whenToUse:
      "Daten dürfen kurz veraltet sein; Cache zeigen, im Hintergrund nachladen (React Query / TTL).",
  },
  realtime: {
    label: "Realtime + kurzes staleTime",
    shortLabel: "Live",
    colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    whenToUse:
      "Änderungen ohne Reload — Supabase Realtime + Invalidation. Live-Provider einmal pro App-Zone mounten (nicht route-conditional bei Soft-Nav).",
  },
  poll: {
    label: "Polling",
    shortLabel: "Poll",
    colorClass: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    whenToUse:
      "Kein Realtime-Kanal, aber regelmäßige Aktualisierung (Intervall, nur sichtbarer Tab).",
  },
  "batch-api": {
    label: "Batch-API (ein Request)",
    shortLabel: "Batch",
    colorClass: "bg-orange-500/15 text-orange-800 dark:text-orange-200",
    whenToUse:
      "Mehrere KPIs auf einer Seite — ein Server-Request, parallele Loader, React Query Cache.",
  },
};

/** Dashboard-Ladereihenfolge (für Superadmin-Flow-Diagramm). */
export const DASHBOARD_LOAD_FLOW_STEP_IDS = [
  "dashboardWidgetPrefs",
  "dashboardSummaries",
  "notificationBell",
  "dashboardWeather",
  "unifiedInbox",
  "channelConnections",
] as const;

export const MODULE_DATA_CACHE_REGISTRY: ModuleCachePolicyEntry[] = [
  {
    id: "dashboardWidgetPrefs",
    label: "Dashboard-Widget-Layout",
    scope: "dashboard",
    appModule: "Dashboard",
    strategy: "optimistic-local",
    description:
      "Sichtbarkeit und Anordnung der Kacheln — sofort aus localStorage, Hintergrund-Sync mit Profil-DB.",
    loadTriggers: ["Mount Dashboard", "Workspace-Restaurant aus Cache"],
    invalidateTriggers: [
      "Speichern in Einstellungen → Dashboard",
      "Workspace-Restaurant-Wechsel",
    ],
    implementationFiles: [
      "lib/contexts/dashboard-widget-preferences-context.tsx",
      "lib/dashboard/dashboard-widget-prefs-client.ts",
    ],
    status: "active",
  },
  {
    id: "dashboardSummaries",
    label: "Dashboard-KPIs (Batch)",
    scope: "dashboard",
    appModule: "Dashboard",
    strategy: "batch-api",
    staleTimeMs: 30_000,
    pollIntervalMs: 60_000,
    gcTimeMs: 5 * 60_000,
    description:
      "Reservierungen, Nachrichten, Bestand, Team, Integrationen, Bewertungen, Speisekarte — ein GET /api/dashboard/summary. Sofort aus localStorage (SWR), Hintergrund-Prefetch sobald Workspace-Restaurant ready, stilles Nachladen.",
    loadTriggers: [
      "DashboardBatchPrefetchMount im App-Layout (Workspace ready)",
      "Mount Dashboard-Startseite (nur sichtbare Widgets)",
      "React Query refetchInterval 60s (sichtbarer Tab)",
      "Kein Tab-Focus-Refetch (außer Realtime/Invalidierung)",
    ],
    invalidateTriggers: [
      "Realtime Reservierungen / Team / Nachrichten",
      "GWADA_WORKSPACE_RESTAURANT_CHANGED",
      "Inbox-Cache-Update (Messages-Patch)",
    ],
    apiEndpoints: ["/api/dashboard/summary"],
    implementationFiles: [
      "lib/hooks/use-dashboard-batch-summary-query.ts",
      "lib/hooks/dashboard-batch-summary-query-options.ts",
      "lib/dashboard/dashboard-batch-summary-cache.ts",
      "lib/dashboard/load-dashboard-batch-summary-server.ts",
      "components/providers/dashboard-batch-query-sync.tsx",
      "components/providers/dashboard-batch-prefetch-mount.tsx",
    ],
    status: "active",
  },
  {
    id: "notificationBell",
    label: "Benachrichtigungs-Glocke",
    scope: "chrome",
    appModule: "App-Chrome",
    strategy: "stale-while-revalidate",
    staleTimeMs: 30_000,
    pollIntervalMs: 60_000,
    gcTimeMs: 5 * 60_000,
    description:
      "Unread-Items aller Module in der Glocke — React Query, kein Doppel-Poll mit Widget-Coordinator. Nachrichten: leichter Unread-Count aus Inbox-DB/WAHA (kein IMAP-Sync beim Öffnen).",
    loadTriggers: [
      "App-Chrome Mount (Workspace ready)",
      "Popover öffnen (nur wenn Cache stale)",
      "Poll 60s (nur sichtbarer Tab)",
    ],
    invalidateTriggers: [
      "GWADA_NOTIFICATIONS_REFRESH",
      "GWADA_DASHBOARD_MESSAGES_REFRESH (debounced 3s)",
      "Workspace-Wechsel",
      "Mark as read",
    ],
    apiEndpoints: ["/api/notifications/summary"],
    implementationFiles: [
      "lib/hooks/use-notification-summary.ts",
      "lib/notifications/notification-summary-server.ts",
      "components/layout/app-chrome-notification-bell.tsx",
    ],
    status: "active",
    notes:
      "Messages nutzt serverseitig WAHA + optional E-Mail-Sync — nicht parallel zum Inbox-Warm starten, wenn Batch kürzlich lief.",
  },
  {
    id: "dashboardWeather",
    label: "Wetter-Kachel",
    scope: "dashboard",
    appModule: "Dashboard",
    strategy: "stale-while-revalidate",
    staleTimeMs: 15 * 60_000,
    pollIntervalMs: 60_000,
    description:
      "Visual Crossing — localStorage + Memory (15 Min Anzeige-Cache), stiller Refetch über Dashboard-Widget-Coordinator (60s); erst nach stabilem Restaurant-Profil (Stadt).",
    loadTriggers: [
      "Profil ready + Standort stabil",
      "Dashboard-Mount: peek Cache, dann silent fetch",
      "Dashboard-Widget-Coordinator 60s (silent)",
    ],
    invalidateTriggers: ["Standort-Änderung (neuer Cache-Key)", "TTL abgelaufen"],
    apiEndpoints: ["/api/weather"],
    implementationFiles: [
      "components/dashboard/dashboard-weather-tile.tsx",
      "lib/weather/dashboard-weather-cache.ts",
    ],
    status: "active",
  },
  {
    id: "channelConnections",
    label: "Kanal-Verbindungsstatus",
    scope: "dashboard",
    appModule: "Nachrichten",
    strategy: "stale-while-revalidate",
    staleTimeMs: 90_000,
    description:
      "WhatsApp/E-Mail/Facebook/Instagram verbunden — sessionStorage-Cache 90s, WAHA-Live-Check nur bei Cache-Miss.",
    loadTriggers: [
      "Unified-Inbox-Mount (Dashboard-Widget, Kontakte, …)",
      "Weitere Screens mit Kanal-Status (Bewertungen, Mitarbeiter, …)",
    ],
    invalidateTriggers: ["TTL abgelaufen", "manuell refresh()"],
    apiEndpoints: ["/api/contact-messages/channels-status"],
    implementationFiles: [
      "lib/hooks/use-restaurant-channel-connections.ts",
      "lib/contact-messages/channel-connections-cache.ts",
    ],
    status: "active",
  },
  {
    id: "unifiedInbox",
    label: "Unified Inbox (Hintergrund)",
    scope: "dashboard",
    appModule: "Nachrichten",
    strategy: "realtime",
    staleTimeMs: 5 * 60 * 1000,
    pollIntervalMs: 5 * 60 * 1000,
    description:
      "Gwada-DB + WAHA/E-Mail/Facebook/Instagram — sessionStorage-Cache, Warm verzögert wenn Batch kürzlich lief; Realtime + 5-Min-Poll.",
    loadTriggers: [
      "Nachrichten-Widget sichtbar auf Dashboard",
      "Warm nach 400ms (übersprungen wenn Batch < 30s)",
      "Poll 5 Min",
      "Meta-Inbox nur wenn OAuth verbunden",
    ],
    invalidateTriggers: [
      "GWADA_DASHBOARD_MESSAGES_REFRESH",
      "Supabase Realtime contact_messages",
    ],
    apiEndpoints: [
      "/api/contact-messages/waha/conversations",
      "/api/contact-messages/email/conversations",
      "/api/contact-messages/meta/conversations",
    ],
    implementationFiles: [
      "components/contacts/unified-inbox-background-sync-mount.tsx",
      "lib/contact-messages/unified-inbox-background-sync.ts",
      "lib/hooks/use-dashboard-live-notifications.ts",
    ],
    status: "active",
  },
  {
    id: "contactsMetaInbox",
    label: "Facebook/Instagram Inbox",
    scope: "module",
    appModule: "Nachrichten",
    strategy: "stale-while-revalidate",
    staleTimeMs: 0,
    description:
      "Graph API live (Lesen + Senden + Reactions + Medien-Proxy); Merge über Unified-Inbox sessionStorage. OAuth über channel-connections (90s).",
    loadTriggers: [
      "Unified Inbox (wenn verbunden)",
      "Filter-Chip Facebook/Instagram",
      "Thread-Öffnung meta:{platform}:{senderId}",
    ],
    invalidateTriggers: [
      "Manueller Inbox-Refresh",
      "Unified-Inbox-Cache-Invalidierung",
    ],
    apiEndpoints: [
      "/api/contact-messages/meta/conversations",
      "/api/contact-messages/meta/messages",
      "/api/contact-messages/meta/send",
      "/api/contact-messages/meta/reaction",
      "/api/contact-messages/meta/media",
    ],
    implementationFiles: [
      "lib/contact-messages/meta-inbox-service.ts",
      "lib/contact-messages/meta-inbox-auth-server.ts",
      "app/api/contact-messages/meta/conversations/route.ts",
      "app/api/contact-messages/meta/messages/route.ts",
    ],
    status: "active",
  },
  {
    id: "dashboardMessages",
    label: "Nachrichten-Kachel (KPI)",
    scope: "dashboard",
    appModule: "Nachrichten",
    strategy: "realtime",
    staleTimeMs: 30_000,
    description:
      "Unread-Zahlen aus Batch; Live-Updates via Inbox-Cache-Patch statt Voll-Invalidierung.",
    loadTriggers: ["Teil von dashboardSummaries Batch"],
    invalidateTriggers: [
      "Inbox-Cache-Update → setQueryData Patch",
      "Realtime → debounced Refresh",
    ],
    implementationFiles: [
      "components/providers/dashboard-batch-query-sync.tsx",
      "lib/contact-messages/messages-unread-summary.ts",
    ],
    status: "active",
  },
  {
    id: "reservationsLive",
    label: "Reservierungen Live",
    scope: "module",
    appModule: "Reservierungen",
    strategy: "realtime",
    staleTimeMs: 60_000,
    pollIntervalMs: 60_000,
    description:
      "Neue Reservierungen per Supabase Realtime — Provider in AppModuleLiveProviders (einmal pro App-Zone, solange Workspace-Restaurant ready). Nicht route-conditional mounten (Soft-Nav). Fallback-Polling 60s bei Realtime-Ausfall oder /sb-Proxy.",
    loadTriggers: [
      "App-Zone platform/(app) + Workspace-Restaurant ready",
      "Fallback: sichtbares Intervall-Polling 60s",
    ],
    invalidateTriggers: [
      "Supabase Realtime reservations INSERT",
      "GWADA_DASHBOARD_RESERVATIONS_REFRESH",
    ],
    implementationFiles: [
      "components/providers/app-module-live-providers.tsx",
      "components/providers/app-reservations-live.tsx",
      "lib/hooks/use-platform-reservations-live.ts",
      "lib/supabase/restaurant-table-realtime.ts",
    ],
    status: "active",
  },
  {
    id: "staffLive",
    label: "Mitarbeiter Live",
    scope: "module",
    appModule: "Mitarbeiter",
    strategy: "realtime",
    staleTimeMs: 30_000,
    pollIntervalMs: 30_000,
    description:
      "Schicht-/Team-Updates per Realtime — gleicher App-Zone-Provider wie Reservierungen (nicht route-conditional). Fallback-Polling 30s bei Realtime-Ausfall oder /sb-Proxy.",
    loadTriggers: [
      "App-Zone platform/(app) + Workspace-Restaurant ready",
      "Fallback: sichtbares Intervall-Polling 30s",
    ],
    invalidateTriggers: [
      "Supabase Realtime staff_* / shifts",
      "GWADA_STAFF_DATA_REFRESH (debounced)",
    ],
    implementationFiles: [
      "components/providers/app-module-live-providers.tsx",
      "components/providers/app-staff-live.tsx",
      "lib/hooks/use-restaurant-staff-realtime.ts",
      "lib/supabase/restaurant-table-realtime.ts",
    ],
    status: "active",
  },
  {
    id: "menuModule",
    label: "Speisekarte (Liste)",
    scope: "module",
    appModule: "Speisekarte",
    strategy: "stale-while-revalidate",
    staleTimeMs: 60_000,
    gcTimeMs: 5 * 60_000,
    description:
      "Gerichte + Kategorien per React Query — localStorage als placeholderData, Invalidierung bei CRUD.",
    loadTriggers: ["Route /dashboard/menu/**", "placeholderData aus LS"],
    invalidateTriggers: [
      "Gericht/Kategorie CRUD",
      "queryKeys.menu.*",
      "dashboard.summaryRoot",
    ],
    implementationFiles: [
      "lib/hooks/use-menu-storage.ts",
      "lib/hooks/use-categories-storage.ts",
      "lib/menu/menu-items-query.ts",
      "lib/menu/menu-categories-query.ts",
    ],
    status: "active",
  },
  {
    id: "inventoryModule",
    label: "Bestand",
    scope: "module",
    appModule: "Bestand",
    strategy: "stale-while-revalidate",
    staleTimeMs: 60_000,
    gcTimeMs: 5 * 60_000,
    description:
      "Zutaten + Bestellungen per React Query; Bestandsänderung invalidiert auch notifications.summary (Low-Stock-Push).",
    loadTriggers: ["Route /dashboard/inventory/**", "placeholderData aus LS"],
    invalidateTriggers: [
      "Zutat/Bestellung speichern",
      "Bestandsänderung → notifications.summary + dashboard.summary",
      "DB-Trigger inventory_low_stock → Push (separater Pfad)",
    ],
    apiEndpoints: ["/api/cron/notification-deliver"],
    implementationFiles: [
      "lib/hooks/use-ingredients-storage.ts",
      "lib/hooks/use-purchase-orders-storage.ts",
      "lib/inventory/ingredients-query.ts",
      "lib/inventory/purchase-orders-query.ts",
    ],
    status: "active",
    notes:
      "Push bei Low Stock läuft über notification_events + Cron — nicht über Client-Cache.",
  },
  {
    id: "notificationPushDelivery",
    label: "Push-Zustellung (Cron)",
    scope: "platform",
    appModule: "Benachrichtigungen",
    strategy: "poll",
    pollIntervalMs: 60_000,
    description:
      "notification_events → Fan-out → claim_notification_deliveries (SKIP LOCKED) — kein Doppelversand bei parallelen Cron-Läufen.",
    loadTriggers: ["/api/cron/notification-deliver"],
    invalidateTriggers: ["claim + processing-Status", "release_stale nach 15min"],
    implementationFiles: [
      "lib/notifications/notification-deliver-cron.ts",
      "lib/notifications/notification-deliver-claim.ts",
      "supabase/migrations/20260622120000_notification_delivery_claim.sql",
    ],
    status: "active",
  },
  {
    id: "contactsInbox",
    label: "Nachrichten-Inbox (Vollansicht)",
    scope: "module",
    appModule: "Nachrichten",
    strategy: "realtime",
    staleTimeMs: 5 * 60 * 1000,
    pollIntervalMs: 5 * 60 * 1000,
    description:
      "Unified-Inbox-Cache + Realtime — Background-Sync-Mount immer auf Kontakte-Routen.",
    loadTriggers: ["/dashboard/kontakte/**"],
    invalidateTriggers: ["Realtime", "Nachricht gesendet/gelesen"],
    implementationFiles: [
      "app/(platform)/(app)/dashboard/kontakte/layout.tsx",
      "lib/contact-messages/unified-inbox-cache.ts",
    ],
    status: "active",
  },
  {
    id: "newsFeed",
    label: "News-Feed (Übersicht)",
    scope: "module",
    appModule: "News",
    strategy: "stale-while-revalidate",
    staleTimeMs: 5 * 60_000,
    gcTimeMs: 30 * 60_000,
    description:
      "Gwada-Posts + externe Kanäle aus DB-Cache — sessionStorage pro Restaurant/Filter, Hintergrund-Refresh ohne Feed zu leeren.",
    loadTriggers: [
      "Mount News-Übersicht",
      "Plattform-Filter-Wechsel",
      "Hintergrund-Sync wenn stale (Poll 5s, max 12×)",
    ],
    invalidateTriggers: [
      "Speichern/Löschen im Detail-Drawer",
      "„Jetzt synchronisieren“",
      "TTL 30 Min (kein sofortiges Rendern mehr)",
    ],
    apiEndpoints: ["/api/news", "/api/news/sync", "/api/public/news/media"],
    implementationFiles: [
      "components/news/news-screen.tsx",
      "lib/news/news-feed-client-cache.ts",
      "lib/news/news-feed-read-server.ts",
    ],
    status: "active",
    notes:
      "Server: restaurant_news_platform_cache + after(triggerNewsFeedSyncIfStale). Plattform-Chips = Client-Filter auf Gesamt-Feed, kein API-Reload.",
  },
  {
    id: "workspaceRestaurant",
    label: "Workspace-Restaurant (UUID)",
    scope: "chrome",
    appModule: "App-Chrome",
    strategy: "optimistic-local",
    description:
      "Aktives Restaurant für alle Module — sofort aus sessionStorage (peek), asynchron auflösen ohne „Kein Restaurant“-Flackern.",
    loadTriggers: [
      "Mount App-Zone: peekCachedWorkspaceRestaurantId",
      "getWorkspaceRestaurantId() nachziehen",
      "GWADA_WORKSPACE_RESTAURANT_CHANGED",
    ],
    invalidateTriggers: [
      "Restaurant-Wechsel in Einstellungen",
      "Workspace-Persistenz aktualisiert",
    ],
    implementationFiles: [
      "lib/hooks/use-workspace-restaurant-uuid.ts",
      "lib/supabase/workspace-persistence.ts",
    ],
    status: "active",
  },
  {
    id: "displayKiosk",
    label: "Display-Kiosk",
    scope: "platform",
    appModule: "Display",
    strategy: "poll",
    pollIntervalMs: 60_000,
    description:
      "Eigene Session-Zone (/display/[slug], kein Supabase-User-JWT). Module per fetch; Reservierungen mit Live-Signal-Poll und stillen Tag-Reloads ohne Full-Skeleton.",
    loadTriggers: [
      "PIN-Login → GET /api/display/context",
      "Modul-Mount: reservations / inventory / recipes / time",
      "Reservierungen: live-signal Poll 60s + GWADA_DISPLAY_RESERVATIONS_REFRESH_EVENT",
      "ToDo-Badge: GET /api/display/todos?badge_only=1",
    ],
    invalidateTriggers: [
      "Tagwechsel im Datepicker: silent load (Toolbar bleibt)",
      "Neue Reservierung (Live-Signal) → Refresh-Event",
      "PIN-Sperre / Entsperren",
    ],
    apiEndpoints: [
      "/api/display/context",
      "/api/display/reservations",
      "/api/display/reservations/live-signal",
      "/api/display/inventory",
      "/api/display/recipes",
      "/api/display/todos",
    ],
    implementationFiles: [
      "components/display/display-screen.tsx",
      "components/display/modules/display-reservations-module.tsx",
      "components/display/modules/display-inventory-module.tsx",
      "lib/hooks/use-display-reservations-live.ts",
      "lib/hooks/use-display-todo-badge-count.ts",
    ],
    status: "active",
    notes:
      "Skeleton nur für dynamische Bereiche beim Erstload — nicht bei Filter-/Picker-Wechsel. Kein AppModuleLiveProviders (andere Auth-Zone).",
  },
  {
    id: "staffTodos",
    label: "Checklisten",
    scope: "module",
    appModule: "Mitarbeiter",
    strategy: "stale-while-revalidate",
    staleTimeMs: 30_000,
    description:
      "Todos + Mitarbeiterliste beim Mount; Suche/Filter/Sortierung clientseitig. Deferred Skeleton nur beim Erstload.",
    loadTriggers: ["Mount /dashboard/checklisten/**"],
    invalidateTriggers: [
      "Todo anlegen / bearbeiten / löschen",
      "Status- oder Zuweisungsänderung",
    ],
    implementationFiles: [
      "components/staff/todos/staff-todos-screen.tsx",
      "lib/supabase/staff-todos-db.ts",
      "lib/staff/staff-display-todos-server.ts",
    ],
    status: "active",
    notes:
      "Display-Zeiterfassung: Popup-Gate über staff-display-todos-server (defer-Trigger).",
  },
  {
    id: "reviewsFeed",
    label: "Bewertungen (Feed)",
    scope: "module",
    appModule: "Bewertungen",
    strategy: "stale-while-revalidate",
    staleTimeMs: 60_000,
    gcTimeMs: 30 * 60_000,
    description:
      "Server-Pagination + Filter; Feed + Channels-Status im Memory/sessionStorage (SWR). Soft-Nav ohne Full-Skeleton, stilles Nachladen.",
    loadTriggers: [
      "Mount Bewertungen-Übersicht (peek Cache)",
      "Seitenwechsel / Filter (Server-Request)",
    ],
    invalidateTriggers: [
      "Antwort gespeichert",
      "Link erstellt / gelöscht",
      "Manueller Refresh",
      "TTL 30 Min",
    ],
    apiEndpoints: ["/api/reviews", "/api/reviews/statistics"],
    implementationFiles: [
      "components/reviews/reviews-screen.tsx",
      "components/reviews/reviews-statistics-screen.tsx",
      "lib/reviews/reviews-feed-session-cache.ts",
      "lib/reviews/reviews-channels-client-cache.ts",
    ],
    status: "active",
  },
  {
    id: "accountingLists",
    label: "Buchführung (Listen)",
    scope: "module",
    appModule: "Buchführung",
    strategy: "stale-while-revalidate",
    staleTimeMs: 60_000,
    gcTimeMs: 30 * 60_000,
    description:
      "Rechnungen, Angebote, Belege, Kasse, Statistik — Client-Cache pro Filter/Seite; Soft-Nav zeigt Cache sofort, Hintergrund-Refresh.",
    loadTriggers: ["Mount Buchführungs-Listen", "Filter-/Seitenwechsel"],
    invalidateTriggers: ["Dokument speichern / Sync", "TTL 30 Min"],
    apiEndpoints: [
      "/api/accounting/invoices",
      "/api/accounting/quotations",
      "/api/accounting/vouchers",
      "/api/accounting/cash-book",
    ],
    implementationFiles: [
      "components/accounting/accounting-sales-documents-screen.tsx",
      "components/accounting/accounting-vouchers-screen.tsx",
      "components/accounting/accounting-cash-book-screen.tsx",
      "lib/accounting/accounting-list-client-cache.ts",
    ],
    status: "active",
  },
  {
    id: "insightsOverview",
    label: "Insights (Übersicht)",
    scope: "module",
    appModule: "Insights",
    strategy: "stale-while-revalidate",
    staleTimeMs: 60_000,
    gcTimeMs: 30 * 60_000,
    description:
      "Statistik-Bundle pro Zeitraum im Client-Cache; Soft-Nav ohne Suspense-Skeleton-Flash.",
    loadTriggers: ["Mount Insights-Übersicht", "Zeitraumwechsel"],
    invalidateTriggers: ["TTL 30 Min"],
    apiEndpoints: ["/api/insights/statistics"],
    implementationFiles: [
      "components/insights/insights-overview-screen.tsx",
      "lib/insights/insights-overview-client-cache.ts",
    ],
    status: "active",
  },
  {
    id: "posOverview",
    label: "POS (Übersicht)",
    scope: "module",
    appModule: "POS",
    strategy: "stale-while-revalidate",
    staleTimeMs: 30_000,
    gcTimeMs: 15 * 60_000,
    description:
      "KPI-Kacheln (Umsatz heute, offene Bestellungen, Kasse) — Memory/sessionStorage, Soft-Nav ohne Skeleton.",
    loadTriggers: ["Mount POS-Übersicht"],
    invalidateTriggers: ["TTL 15 Min"],
    implementationFiles: [
      "components/pos/pos-overview-screen.tsx",
      "lib/pos/pos-overview-client-cache.ts",
    ],
    status: "active",
  },
];

export const MODULE_DATA_CACHE_POLICY = Object.fromEntries(
  MODULE_DATA_CACHE_REGISTRY.map((entry) => [
    entry.id,
    {
      strategy: entry.strategy,
      staleTimeMs: entry.staleTimeMs,
      pollIntervalMs: entry.pollIntervalMs,
      gcTimeMs: entry.gcTimeMs,
    },
  ]),
) as Record<
  string,
  {
    strategy: ModuleCacheStrategy;
    staleTimeMs?: number;
    pollIntervalMs?: number;
    gcTimeMs?: number;
  }
>;

export function getModuleCachePolicy(
  id: string,
): ModuleCachePolicyEntry | undefined {
  return MODULE_DATA_CACHE_REGISTRY.find((e) => e.id === id);
}

export function getModuleCacheStaleTime(id: string): number | undefined {
  return getModuleCachePolicy(id)?.staleTimeMs;
}

export function getModuleCachePollInterval(id: string): number | undefined {
  return getModuleCachePolicy(id)?.pollIntervalMs;
}

export function getModuleCacheGcTime(id: string): number | undefined {
  return getModuleCachePolicy(id)?.gcTimeMs;
}

export function listModuleCachePolicies(): ModuleCachePolicyEntry[] {
  return [...MODULE_DATA_CACHE_REGISTRY];
}

export function listModuleCachePoliciesByScope(
  scope: ModuleCacheScope,
): ModuleCachePolicyEntry[] {
  return MODULE_DATA_CACHE_REGISTRY.filter((e) => e.scope === scope);
}

/** Kurz-Anleitung für neue Module (Superadmin + Code-Review). */
export const MODULE_CACHE_DECISION_GUIDE: {
  question: string;
  recommendation: ModuleCacheStrategy;
  hint: string;
}[] = [
  {
    question: "Nur UI-Einstellungen, Offline-First ok?",
    recommendation: "optimistic-local",
    hint: "Widget-Prefs, letzte Filter — localStorage + Hintergrund-DB.",
  },
  {
    question: "Viele KPIs auf einer Übersichtsseite?",
    recommendation: "batch-api",
    hint: "Ein API-Route mit parallelen Server-Loadern + React Query.",
  },
  {
    question: "Muss sofort bei DB-Änderung aktualisieren?",
    recommendation: "realtime",
    hint: "Supabase Channel + invalidateQueries / Patch — Provider app-weit in AppModuleLiveProviders, nicht pro Route ein-/ausblenden.",
  },
  {
    question: "Selten ändernde Listen, Zurück-Navigation wichtig?",
    recommendation: "stale-while-revalidate",
    hint: "React Query staleTime 30s–5min, placeholderData, refetchOnFocus.",
  },
  {
    question: "Kein Realtime, aber aktuell genug?",
    recommendation: "poll",
    hint: "refetchInterval nur bei sichtbarem Tab — Intervall in Registry dokumentieren.",
  },
  {
    question: "Filter/Picker wechselt — nicht die ganze Seite skeletonisieren?",
    recommendation: "stale-while-revalidate",
    hint:
      "Erstload: Skeleton nur für Datenbereich (Toolbar sichtbar lassen); Refetch silent bis neue Daten da sind. Display Reservierungen (Tag-Picker), Display Bestand/Rezepte.",
  },
];
