/**
 * Zentrale Registry für Lade- und Cache-Strategien pro Datenbereich.
 * Superadmin → „Lade-Strategie“ visualisiert diese Datei.
 * Bei neuen Modulen: Eintrag ergänzen, Konstanten hierher ziehen, UI zeigt den Stand.
 *
 * Navigationsmodell (Stand 2026):
 * - Dashboard-Zone (`/dashboard/*`): Vite/TanStack SPA + Modul-Home Keep-alive
 *   (Sibling zu Outlet), Route-Chunk-Preload, SoftNav-Shim
 * - Superadmin-Zone (`/superadmin/*`): Vite/TanStack SPA (wie Dashboard)
 * - Provider/Caches (Auth, Restaurant, React Query, Realtime) bleiben im Next
 *   `(app)`-Layout gemountet (kein Full-Load bei Modulwechsel)
 * - Soft-Nav zwischen App-Modulen (Provider/Caches bleiben gemountet)
 * - Full-Load nur App ↔ Superadmin über `/zone/enter`
 * - Realtime einmal pro App-Zone (`AppModuleLiveProviders`), nicht route-conditional
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
      "Daten dürfen kurz veraltet sein — React Query und/oder sessionStorage-Feeds; Modulwechsel zeigt Cache sofort, Warm-Prefetch / TanStack-Preload füllt nach.",
  },
  realtime: {
    label: "Realtime + kurzes staleTime",
    shortLabel: "Live",
    colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    whenToUse:
      "Änderungen ohne Reload — Supabase Realtime + Invalidation/Patch. Einmal pro App-Zone in AppModuleLiveProviders (nicht route-conditional). Fallback-Poll bei Proxy/CHANNEL_ERROR.",
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

/**
 * App-Zone-Ladereihenfolge (für Superadmin-Flow-Diagramm).
 * Dashboard-Batch streamt Widgets als NDJSON (Time-to-first-KPI).
 * FULL-Routes sofort; API-Warm nach erstem KPI-Event (Failsafe ~0.9s). Inbox-Warm skip nur bei warmem Cache.
 */
export const DASHBOARD_LOAD_FLOW_STEP_IDS = [
  "workspaceRestaurant",
  "dashboardWidgetPrefs",
  "appModuleWarmPrefetch",
  "dashboardSummaries",
  "channelConnections",
  "unifiedInbox",
  "notificationBell",
  "dashboardWeather",
] as const;

export const MODULE_DATA_CACHE_REGISTRY: ModuleCachePolicyEntry[] = [
  {
    id: "workspaceRestaurant",
    label: "Workspace-Restaurant (UUID)",
    scope: "chrome",
    appModule: "App-Chrome",
    strategy: "optimistic-local",
    description:
      "Aktives Restaurant für alle Module — sofort aus sessionStorage (peek), asynchron auflösen ohne „Kein Restaurant“-Flackern. Gate für Warm-Prefetch, Batch und Live-Provider.",
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
      "components/workspace/workspace-restaurant-placeholder.tsx",
    ],
    status: "active",
  },
  {
    id: "softNavChrome",
    label: "Dashboard-SPA & App-Navigation",
    scope: "chrome",
    appModule: "App-Chrome",
    strategy: "optimistic-local",
    description:
      "Dashboard (`/dashboard/*`): Vite/TanStack SPA + Keep-alive Homes, SoftNavLock = Pending-UI + letzter Klick gewinnt, Predictive Prefetch (Nachbarn + Recent). Superadmin (`/superadmin/*`): Vite/TanStack SPA. Provider (Auth, Restaurant, React Query, Realtime) bleiben im Next-(app)-Layout. Full-Load nur App ↔ Superadmin über /zone/enter.",
    loadTriggers: [
      "AppNavLink / Sidebar-Klick (prefetch={false}, Intent-Warm on hover/focus)",
      "Keep-alive Homes: alle Sidebar-Übersichten (+ Dashboard)",
      "Priority-Prewarm nach KPI; Secondary idle/~2.2s; Intent flushSync",
      "AppModulePredictivePrefetchMount nach Pathname-Settle",
      "Pending-Overlay übersprungen bei warmem Keep-alive-Home oder isModuleSoftNavDataReady",
      "Hover/Focus: prefetchDashboardSpaHref (Route-Chunk) + Warm-Daten",
    ],
    invalidateTriggers: [
      "Zonenwechsel App ↔ Superadmin (Full-Load)",
      "Workspace-Restaurant-Wechsel",
    ],
    implementationFiles: [
      "components/navigation/app-zone-router.tsx",
      "apps/dashboard/src/DashboardSPA.tsx",
      "apps/dashboard/src/router/route-tree.tsx",
      "apps/dashboard/src/navigation/prefetch-dashboard-route.ts",
      "lib/navigation/spa-next-shims/next-navigation.tsx",
      "components/navigation/app-nav-link.tsx",
      "components/providers/soft-nav-lock-provider.tsx",
      "components/navigation/soft-nav-pending-overlay.tsx",
      "components/navigation/app-module-home-keep-alives.tsx",
      "lib/navigation/module-soft-nav-data-ready.ts",
      "lib/navigation/app-module-predictive-prefetch.ts",
      "components/providers/app-module-predictive-prefetch-mount.tsx",
      "lib/navigation/workspace-zone-enter.ts",
    ],
    status: "active",
    notes:
      "Realtime nie route-conditional mounten/unmounten — Soft-Nav-Remount-Race (postgres_changes after subscribe). Modul-Homes: Keep-alive Sibling zu Outlet (keepAliveHome).",
  },
  {
    id: "appModuleWarmPrefetch",
    label: "Modul-Warm-Prefetch",
    scope: "chrome",
    appModule: "App-Chrome",
    strategy: "stale-while-revalidate",
    staleTimeMs: 5 * 60_000,
    description:
      "Nach Workspace ready: sessionStorage → React Query seed. Dashboard-SPA: TanStack Route-Preload statt Next FULL-RSC. Modul-API-Daten nach erstem Dashboard-KPI (oder sofort wenn Batch-Cache warm). Intent-Warm bei Sidebar/Chip-Hover/Tap (Chunk + Daten).",
    loadTriggers: [
      "AppModuleWarmPrefetchMount (einmal pro Restaurant, zwei Effects)",
      "prefetchDashboardSpaHref / preloadRoute gestaffelt für Priority-Module",
      "notifyDashboardFirstKpiReady → critical + menu/inventory + Priority-Daten",
      "Failsafe 2.5s auf /dashboard ohne KPI-Event",
      "Idle ~5s: Secondary-Warm (News/Reviews/…)",
      "Sidebar/Chip hover/focus → warmModuleRouteIntent",
    ],
    invalidateTriggers: [
      "Workspace-Restaurant-Wechsel (Warm erneut)",
      "Modul-CRUD invalidiert jeweilige Query-/Feed-Caches",
    ],
    implementationFiles: [
      "components/providers/app-module-warm-prefetch-mount.tsx",
      "lib/hooks/app-module-intent-prefetch.ts",
      "lib/hooks/app-module-warm-prefetch.ts",
      "lib/hooks/app-module-query-prefetch.ts",
      "lib/navigation/prefetch-app-module-href.ts",
    ],
    status: "active",
    notes:
      "Warm-Skip nutzt FEED_STALE_MS = 5 Min über Feeds hinweg — unabhängig von kürzeren Screen-staleTimes.",
  },
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
      "Reservierungen, Nachrichten, Bestand, Team, … — GET /api/dashboard/summary als NDJSON-Stream (jedes Widget paintet sofort). Sofort aus localStorage (SWR), Hintergrund-Prefetch sobald Workspace-Restaurant ready. Live-Patches app-weit über AppDashboardLivePatchMount.",
    loadTriggers: [
      "DashboardBatchPrefetchMount im App-Layout (Workspace ready, idle ~1.6s)",
      "Mount Dashboard-Startseite: stream=1, onPartial → setQueryData pro Widget",
      "React Query refetchInterval 60s (sichtbarer Tab, Keep-alive Home aktiv)",
      "Kein Tab-Focus-Refetch (außer Realtime/Invalidierung)",
    ],
    invalidateTriggers: [
      "Realtime → AppDashboardLivePatchMount (Patch statt Voll-Refetch)",
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
      "components/providers/app-dashboard-live-patch-mount.tsx",
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
      "Unread-Items aller Module in der Glocke — React Query + AppNotificationBellLive (notification_events). Poll 60s nur wenn Realtime nicht aktiv. Nachrichten: leichter Unread-Count aus Inbox-DB/WAHA (kein IMAP-Sync beim Öffnen).",
    loadTriggers: [
      "App-Chrome Mount (Workspace ready)",
      "Popover öffnen (nur wenn Cache stale)",
      "Poll 60s (sichtbarer Tab, nur ohne aktives Bell-Realtime)",
    ],
    invalidateTriggers: [
      "GWADA_NOTIFICATIONS_REFRESH",
      "GWADA_DASHBOARD_MESSAGES_REFRESH (debounced 3s)",
      "Realtime notification_events",
      "Workspace-Wechsel",
      "Mark as read",
    ],
    apiEndpoints: ["/api/notifications/summary"],
    implementationFiles: [
      "lib/hooks/use-notification-summary.ts",
      "lib/hooks/use-notification-bell-realtime.ts",
      "lib/notifications/notification-summary-server.ts",
      "components/layout/app-chrome-notification-bell.tsx",
      "components/providers/app-notification-bell-live.tsx",
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
    staleTimeMs: 3 * 60 * 60_000,
    pollIntervalMs: 60_000,
    description:
      "Visual Crossing — localStorage + Memory (Anzeige-Cache max. 3h), stiller Refetch über Dashboard-Widget-Coordinator (60s) nur solange Dashboard-Home Keep-alive aktiv; erst nach stabilem Restaurant-Profil (Stadt). 7-Tage-Prognose nur beim Antippen der Kachel (eigener Cache-Key from/to, serverseitig weather_timeline_cache).",
    loadTriggers: [
      "Profil ready + Standort stabil",
      "Dashboard-Mount: peek Cache, dann silent fetch",
      "Dashboard-Widget-Coordinator 60s (silent, nur Home aktiv)",
    ],
    invalidateTriggers: ["Standort-Änderung (neuer Cache-Key)", "TTL 3h abgelaufen"],
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
      "Unified-Inbox-Mount (App-Layout, Dashboard-Widget, Kontakte, …)",
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
      "Gwada-DB + WAHA/E-Mail/Facebook/Instagram — sessionStorage-Cache (30 Min Session). Öffnen: Cache sofort, Force-Refetch nur wenn älter als 5 Min (SWR); sonst Background-Poll 5 Min + Realtime. Keep-alive Home in Dashboard-SPA. Mount app-weit im (app)-Layout.",
    loadTriggers: [
      "UnifiedInboxBackgroundSyncMount im App-Layout",
      "Nachrichten Keep-alive Slot (warm nach Soft-Nav/Hover)",
      "Nachrichten-Widget sichtbar auf Dashboard",
      "Warm nach 400ms (übersprungen wenn Cache frisch < 5 Min oder Batch < 30s)",
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
      "app/(platform)/(app)/layout.tsx",
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
      "Unread-Zahlen aus Batch; Live-Updates via Inbox-Cache-Patch / AppDashboardLivePatchMount statt Voll-Invalidierung.",
    loadTriggers: ["Teil von dashboardSummaries Batch"],
    invalidateTriggers: [
      "Inbox-Cache-Update → setQueryData Patch",
      "Realtime → debounced Refresh",
    ],
    implementationFiles: [
      "components/providers/dashboard-batch-query-sync.tsx",
      "components/providers/app-dashboard-live-patch-mount.tsx",
      "lib/contact-messages/messages-unread-summary.ts",
    ],
    status: "active",
  },
  {
    id: "dashboardWidgetsLive",
    label: "Dashboard-Widgets Live",
    scope: "dashboard",
    appModule: "Dashboard",
    strategy: "realtime",
    pollIntervalMs: 60_000,
    description:
      "Realtime auf menu/contacts/inventory/reviews/integrations — invalidiert bzw. patched Batch-Slices. Teil von AppModuleLiveProviders (Zone-Level).",
    loadTriggers: [
      "App-Zone platform/(app) + Workspace-Restaurant ready",
      "Fallback: sichtbares Intervall-Polling 60s",
    ],
    invalidateTriggers: [
      "Supabase postgres_changes auf Widget-Tabellen",
      "AppDashboardLivePatchMount",
    ],
    implementationFiles: [
      "components/providers/app-module-live-providers.tsx",
      "components/providers/app-dashboard-widgets-live.tsx",
      "lib/supabase/restaurant-table-realtime.ts",
    ],
    status: "active",
  },
  {
    id: "reservationsLive",
    label: "Reservierungen Live",
    scope: "module",
    appModule: "Reservierungen",
    strategy: "realtime",
    pollIntervalMs: 60_000,
    description:
      "Neue/geänderte Reservierungen per Supabase Realtime — Provider in AppModuleLiveProviders (einmal pro App-Zone). Nicht route-conditional. Fallback-Polling 60s bei Realtime-Ausfall oder /sb-Proxy.",
    loadTriggers: [
      "App-Zone platform/(app) + Workspace-Restaurant ready",
      "Fallback: sichtbares Intervall-Polling 60s",
    ],
    invalidateTriggers: [
      "Supabase Realtime reservations INSERT/UPDATE",
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
    id: "reservationsModule",
    label: "Reservierungen (Listen-Cache)",
    scope: "module",
    appModule: "Reservierungen",
    strategy: "stale-while-revalidate",
    staleTimeMs: 3 * 60_000,
    gcTimeMs: 5 * 60_000,
    description:
      "Monats- und Unconfirmed-Listen per React Query; sessionStorage-Peek für Soft-Nav/Warm. Live-Events patchen den Cache; Keep-alive hält die Übersicht gemountet.",
    loadTriggers: [
      "Warm-Prefetch / Intent (Priority)",
      "Mount Reservierungen (Keep-alive Home)",
      "placeholderData aus sessionStorage",
    ],
    invalidateTriggers: [
      "Realtime / Live-Patch",
      "CRUD Reservierung",
      "queryKeys.reservations.*",
    ],
    implementationFiles: [
      "lib/reservations/reservations-list-query.ts",
      "lib/reservations/reservations-month-client-cache.ts",
      "components/reservations/reservations-overview.tsx",
    ],
    status: "active",
  },
  {
    id: "staffLive",
    label: "Mitarbeiter Live",
    scope: "module",
    appModule: "Mitarbeiter",
    strategy: "realtime",
    pollIntervalMs: 30_000,
    description:
      "Schicht-/Team-Updates per Realtime — gleicher App-Zone-Provider wie Reservierungen. Fallback-Polling 30s bei Realtime-Ausfall oder /sb-Proxy.",
    loadTriggers: [
      "App-Zone platform/(app) + Workspace-Restaurant ready",
      "Fallback: sichtbares Intervall-Polling 30s",
    ],
    invalidateTriggers: [
      "Supabase Realtime restaurant_staff / work entries",
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
    id: "staffModule",
    label: "Mitarbeiter (Listen-Cache)",
    scope: "module",
    appModule: "Mitarbeiter",
    strategy: "stale-while-revalidate",
    staleTimeMs: 3 * 60_000,
    gcTimeMs: 5 * 60_000,
    description:
      "Staff-Liste, Verträge und Day-Stats per React Query; sessionStorage-Peek + Warm-Prefetch. Live invalidiert/refetched die Queries.",
    loadTriggers: [
      "Warm-Prefetch / Intent (Priority)",
      "Mount Mitarbeiter-Routen",
      "placeholderData aus sessionStorage",
    ],
    invalidateTriggers: [
      "Realtime / GWADA_STAFF_DATA_REFRESH",
      "CRUD Mitarbeiter/Schicht",
      "queryKeys.staff.*",
    ],
    implementationFiles: [
      "lib/staff/staff-list-query.ts",
      "lib/staff/staff-day-stats-query.ts",
      "lib/staff/staff-list-client-cache.ts",
    ],
    status: "active",
  },
  {
    id: "menuModule",
    label: "Speisekarte (Liste)",
    scope: "module",
    appModule: "Speisekarte",
    strategy: "stale-while-revalidate",
    staleTimeMs: 3 * 60_000,
    gcTimeMs: 30 * 60_000,
    description:
      "Gerichte + Kategorien per React Query — localStorage als placeholderData, Idle-Warm im App-Layout, Invalidierung bei CRUD.",
    loadTriggers: [
      "AppModuleWarmPrefetchMount / Intent",
      "Route /dashboard/menu/**",
      "placeholderData aus LS",
    ],
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
    staleTimeMs: 3 * 60_000,
    gcTimeMs: 30 * 60_000,
    description:
      "Zutaten + Bestellungen per React Query; Bestandsänderung invalidiert auch notifications.summary (Low-Stock-Push).",
    loadTriggers: [
      "AppModuleWarmPrefetchMount / Intent",
      "Route /dashboard/inventory/**",
      "placeholderData aus LS",
    ],
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
      "Unified-Inbox-Cache + Realtime — Background-Sync app-weit im (app)-Layout; Kontakte-Layout nur Chrome/Keep-alive. Soft-Nav hält den Thread-State.",
    loadTriggers: [
      "UnifiedInboxBackgroundSyncMount (App-Layout)",
      "Keep-alive Home Nachrichten/Kontakte",
      "/dashboard/kontakte/**",
    ],
    invalidateTriggers: ["Realtime", "Nachricht gesendet/gelesen"],
    implementationFiles: [
      "components/contacts/unified-inbox-background-sync-mount.tsx",
      "lib/contact-messages/unified-inbox-cache.ts",
      "app/(platform)/(app)/dashboard/kontakte/layout.tsx",
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
      "Gwada-Posts + externe Kanäle aus DB-Cache — sessionStorage pro Restaurant/Filter, Hintergrund-Refresh ohne Feed zu leeren. Warm im Secondary-Idle.",
    loadTriggers: [
      "Warm-Prefetch (Secondary)",
      "Mount News-Übersicht",
      "Plattform-Filter-Wechsel",
      "Hintergrund-Sync wenn stale (Poll 5s, max 3×)",
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
    id: "eventsFeed",
    label: "Events (Feed)",
    scope: "module",
    appModule: "Events",
    strategy: "stale-while-revalidate",
    staleTimeMs: 5 * 60_000,
    gcTimeMs: 30 * 60_000,
    description:
      "Event-Liste im sessionStorage; Soft-Nav zeigt Cache, Secondary-Warm füllt nach.",
    loadTriggers: ["Warm-Prefetch (Secondary)", "Mount Events-Übersicht"],
    invalidateTriggers: ["Event speichern / löschen", "TTL"],
    implementationFiles: [
      "lib/events/events-feed-client-cache.ts",
      "lib/hooks/app-module-warm-prefetch.ts",
    ],
    status: "active",
  },
  {
    id: "galleryFeed",
    label: "Galerie (Feed)",
    scope: "module",
    appModule: "Galerie",
    strategy: "stale-while-revalidate",
    staleTimeMs: 5 * 60_000,
    gcTimeMs: 30 * 60_000,
    description:
      "Galerie-Medien im sessionStorage; Soft-Nav + Secondary-Warm.",
    loadTriggers: ["Warm-Prefetch (Secondary)", "Mount Galerie"],
    invalidateTriggers: ["Upload / Löschen", "TTL"],
    implementationFiles: [
      "lib/gallery/gallery-feed-client-cache.ts",
      "lib/hooks/app-module-warm-prefetch.ts",
    ],
    status: "active",
  },
  {
    id: "documentsList",
    label: "Dokumente (Liste)",
    scope: "module",
    appModule: "Dokumente",
    strategy: "stale-while-revalidate",
    staleTimeMs: 5 * 60_000,
    gcTimeMs: 30 * 60_000,
    description:
      "Dokumentenliste im sessionStorage; Soft-Nav + Secondary-Warm.",
    loadTriggers: ["Warm-Prefetch (Secondary)", "Mount Dokumente"],
    invalidateTriggers: ["Dokument speichern / löschen", "TTL"],
    implementationFiles: [
      "lib/documents/documents-list-client-cache.ts",
      "lib/hooks/app-module-warm-prefetch.ts",
    ],
    status: "active",
  },
  {
    id: "displayKiosk",
    label: "Display-Kiosk",
    scope: "platform",
    appModule: "Display",
    strategy: "poll",
    pollIntervalMs: 2_000,
    description:
      "Eigene Session-Zone (/display/[slug], kein Supabase-User-JWT). Module per fetch; Reservierungen mit Live-Signal-Poll (2s) und stillen Tag-Reloads ohne Full-Skeleton.",
    loadTriggers: [
      "PIN-Login → GET /api/display/context",
      "Modul-Mount: reservations / inventory / recipes / time",
      "Reservierungen: live-signal Poll 2s + GWADA_DISPLAY_RESERVATIONS_REFRESH_EVENT",
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
      "Skeleton nur für dynamische Bereiche beim Erstload — nicht bei Filter-/Picker-Wechsel. Kein AppModuleLiveProviders (andere Auth-Zone). Andere Display-Refreshes (z. B. Wetter) nutzen eigene TTLs (3h).",
  },
  {
    id: "staffTodos",
    label: "Aufgaben",
    scope: "module",
    appModule: "Mitarbeiter",
    strategy: "stale-while-revalidate",
    staleTimeMs: 5 * 60_000,
    description:
      "Todos + Mitarbeiterliste — sessionStorage-Cache, Secondary-Warm; Suche/Filter/Sortierung clientseitig. Deferred Skeleton nur beim Erstload.",
    loadTriggers: [
      "Warm-Prefetch (Secondary)",
      "Mount /dashboard/checklisten/**",
    ],
    invalidateTriggers: [
      "Todo anlegen / bearbeiten / löschen",
      "Status- oder Zuweisungsänderung",
    ],
    implementationFiles: [
      "components/staff/todos/staff-todos-screen.tsx",
      "lib/staff/staff-todos-client-cache.ts",
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
      "Server-Pagination + Filter; Feed + Channels-Status im Memory/sessionStorage (SWR). Soft-Nav ohne Full-Skeleton, stilles Nachladen. Warm-Skip 5 Min.",
    loadTriggers: [
      "Warm-Prefetch (Secondary)",
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
      "Rechnungen, Angebote, Belege, Kasse, Statistik — Client-Cache pro Filter/Seite; Soft-Nav zeigt Cache sofort, Hintergrund-Refresh. Warm Secondary.",
    loadTriggers: [
      "Warm-Prefetch (Secondary)",
      "Mount Buchführungs-Listen",
      "Filter-/Seitenwechsel",
    ],
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
      "Statistik-Bundle pro Zeitraum im Client-Cache; Soft-Nav ohne Suspense-Skeleton-Flash. Warm Secondary.",
    loadTriggers: [
      "Warm-Prefetch (Secondary)",
      "Mount Insights-Übersicht",
      "Zeitraumwechsel",
    ],
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
      "KPI-Kacheln (Umsatz heute, offene Bestellungen, Kasse) — Memory/sessionStorage, Soft-Nav ohne Skeleton. Warm Secondary (Skip 5 Min).",
    loadTriggers: ["Warm-Prefetch (Secondary)", "Mount POS-Übersicht"],
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
    hint: "Widget-Prefs, letzte Filter — localStorage + Hintergrund-DB. Workspace-UUID: peek + Resolve-Placeholder.",
  },
  {
    question: "Viele KPIs auf einer Übersichtsseite?",
    recommendation: "batch-api",
    hint: "Ein API-Route mit parallelen Server-Loadern + React Query; Live-Patches statt Voll-Invalidierung.",
  },
  {
    question: "Muss sofort bei DB-Änderung aktualisieren?",
    recommendation: "realtime",
    hint: "Supabase Channel + invalidateQueries / Patch — Provider app-weit in AppModuleLiveProviders, nicht pro Route ein-/ausblenden. Fallback-Poll dokumentieren.",
  },
  {
    question: "Selten ändernde Listen, schneller Modulwechsel / Zurück wichtig?",
    recommendation: "stale-while-revalidate",
    hint: "React Query oder sessionStorage-Feed, staleTime 30s–5min, Warm über AppModuleWarmPrefetchMount / Intent. Dashboard-SPA: TanStack-Preload + Cache — kein Full-Skeleton bei warmem Cache.",
  },
  {
    question: "Kein Realtime, aber aktuell genug?",
    recommendation: "poll",
    hint: "refetchInterval nur bei sichtbarem Tab — Intervall in Registry dokumentieren (Display live-signal: 2s).",
  },
  {
    question: "Filter/Picker wechselt — nicht die ganze Seite skeletonisieren?",
    recommendation: "stale-while-revalidate",
    hint:
      "Erstload: Deferred Skeleton nur für Datenbereich; Refetch silent. Dashboard-SPA hält Provider gemountet; Modul-Screens lazy mit Query-Cache.",
  },
];
