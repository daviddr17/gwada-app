/** Auto-generated — run: node scripts/generate-dashboard-vite-routes.mjs
 * Profile/Settings/Staff/Changelog/POS use chrome wrappers (layouts pruned with SPA).
 */
import { lazy, type ComponentType } from "react";
import { wrapChangelogPage } from "../routes/changelog-chrome";
import { wrapProfilePage } from "../routes/profile-chrome";
import { wrapSettingsPage } from "../routes/settings-chrome";
import { wrapStaffPage } from "../routes/staff-chrome";
import { wrapPosComingSoonPage } from "@/components/pos/pos-coming-soon-gate";

function profileLazy(
  importer: () => Promise<{ default: ComponentType }>,
) {
  return lazy(async () => {
    const mod = await importer();
    return { default: wrapProfilePage(mod.default) };
  });
}

function settingsLazy(
  importer: () => Promise<{ default: ComponentType }>,
) {
  return lazy(async () => {
    const mod = await importer();
    return { default: wrapSettingsPage(mod.default) };
  });
}

function staffLazy(
  importer: () => Promise<{ default: ComponentType }>,
) {
  return lazy(async () => {
    const mod = await importer();
    return { default: wrapStaffPage(mod.default) };
  });
}

function changelogLazy(
  importer: () => Promise<{ default: ComponentType }>,
) {
  return lazy(async () => {
    const mod = await importer();
    return { default: wrapChangelogPage(mod.default) };
  });
}

function posLazy(
  importer: () => Promise<{ default: ComponentType }>,
) {
  return lazy(async () => {
    const mod = await importer();
    return { default: wrapPosComingSoonPage(mod.default) };
  });
}

const Lazy__dashboard_bewertungen_einbinden = lazy(() => import("@/components/reviews/reviews-embed-panel").then((m) => ({ default: m.ReviewsEmbedPanel as ComponentType })));
const Lazy__dashboard_bewertungen_einstellungen = lazy(() => import("@/components/reviews/reviews-settings-panel").then((m) => ({ default: m.ReviewsSettingsPanel as ComponentType })));
const Lazy__dashboard_bewertungen_statistiken = lazy(() => import("@/components/reviews/reviews-statistics-screen").then((m) => ({ default: m.ReviewsStatisticsScreen as ComponentType })));
const Lazy__dashboard_buchfuehrung_angebote = lazy(() => import("@/components/accounting/accounting-quotations-screen").then((m) => ({ default: m.AccountingQuotationsScreen as ComponentType })));
const Lazy__dashboard_buchfuehrung_belege = lazy(() => import("@/components/accounting/accounting-vouchers-screen").then((m) => ({ default: m.AccountingVouchersScreen as ComponentType })));
const Lazy__dashboard_buchfuehrung_einstellungen = lazy(() => import("@/components/accounting/accounting-settings-form").then((m) => ({ default: m.AccountingSettingsForm as ComponentType })));
const Lazy__dashboard_buchfuehrung_kasse = lazy(() => import("@/components/accounting/accounting-cash-book-screen").then((m) => ({ default: m.AccountingCashBookScreen as ComponentType })));
const Lazy__dashboard_buchfuehrung_statistiken = lazy(() => import("@/components/accounting/accounting-statistics-screen").then((m) => ({ default: m.AccountingStatisticsScreen as ComponentType })));
const Lazy__dashboard_checklisten_einstellungen = lazy(() => import("@/components/checklisten/checklisten-settings-screen").then((m) => ({ default: m.ChecklistenSettingsScreen as ComponentType })));
const Lazy__dashboard_checklisten_protokoll = lazy(() => import("@/components/checklisten/checklist-protocol-screen").then((m) => ({ default: m.ChecklistProtocolScreen as ComponentType })));
const Lazy__dashboard_dokumente_protokoll = lazy(() => import("@/components/documents/documents-protocol-screen").then((m) => ({ default: m.DocumentsProtocolScreen as ComponentType })));
const Lazy__dashboard_dokumente_statistiken = lazy(() => import("@/components/documents/documents-statistics-screen").then((m) => ({ default: m.DocumentsStatisticsScreen as ComponentType })));
const Lazy__dashboard_events_einbinden = lazy(() => import("@/components/events/events-embed-panel").then((m) => ({ default: m.EventsEmbedPanel as ComponentType })));
const Lazy__dashboard_events_einstellungen = lazy(() => import("@/components/events/events-settings-panel").then((m) => ({ default: m.EventsSettingsPanel as ComponentType })));
const Lazy__dashboard_events_statistiken = lazy(() => import("@/components/events/events-statistics-screen").then((m) => ({ default: m.EventsStatisticsScreen as ComponentType })));
const Lazy__dashboard_galerie_einbinden = lazy(() => import("@/components/gallery/gallery-embed-panel").then((m) => ({ default: m.GalleryEmbedPanel as ComponentType })));
const Lazy__dashboard_galerie_einstellungen = lazy(() => import("@/components/gallery/gallery-settings-panel").then((m) => ({ default: m.GallerySettingsPanel as ComponentType })));
const Lazy__dashboard_galerie_statistiken = lazy(() => import("@/components/gallery/gallery-statistics-screen").then((m) => ({ default: m.GalleryStatisticsScreen as ComponentType })));
const Lazy__dashboard_inventory_bestellung = lazy(() => import("@/components/inventory/purchase-orders-screen").then((m) => ({ default: m.PurchaseOrdersScreen as ComponentType })));
const Lazy__dashboard_inventory_statistiken = lazy(() => import("@/components/inventory/inventory-statistics-screen").then((m) => ({ default: m.InventoryStatisticsScreen as ComponentType })));
const Lazy__dashboard_kontakte_einstellungen = lazy(() => import("@/components/contacts/contact-settings-form").then((m) => ({ default: m.ContactSettingsForm as ComponentType })));
const Lazy__dashboard_kontakte_export = lazy(() => import("@/components/contacts/contacts-export-screen").then((m) => ({ default: m.ContactsExportScreen as ComponentType })));
const Lazy__dashboard_kontakte_statistiken = lazy(() => import("@/components/contacts/contacts-statistics-screen").then((m) => ({ default: m.ContactsStatisticsScreen as ComponentType })));
const Lazy__dashboard_kontakte_uebersicht = lazy(() => import("@/components/contacts/contacts-overview").then((m) => ({ default: m.ContactsOverview as ComponentType })));
const Lazy__dashboard_menu_einbinden = lazy(() => import("@/components/menu/menu-embed-panel").then((m) => ({ default: m.MenuEmbedPanel as ComponentType })));
const Lazy__dashboard_menu_einstellungen = lazy(() => import("@/components/menu/menu-settings-form").then((m) => ({ default: m.MenuSettingsForm as ComponentType })));
const Lazy__dashboard_menu_export = lazy(() => import("@/components/menu/menu-export-screen").then((m) => ({ default: m.MenuExportScreen as ComponentType })));
const Lazy__dashboard_menu_statistiken = lazy(() => import("@/components/menu/menu-statistics-screen").then((m) => ({ default: m.MenuStatisticsScreen as ComponentType })));
const Lazy__dashboard_mitarbeiter_arbeitszeiten = staffLazy(() => import("@/components/staff/staff-work-hours-screen").then((m) => ({ default: m.StaffWorkHoursScreen as ComponentType })));
const Lazy__dashboard_mitarbeiter_dokumente = staffLazy(() => import("@/components/staff/staff-documents-screen").then((m) => ({ default: m.StaffDocumentsScreen as ComponentType })));
const Lazy__dashboard_mitarbeiter_einstellungen = staffLazy(() => import("@/components/staff/staff-settings-form").then((m) => ({ default: m.StaffSettingsForm as ComponentType })));
const Lazy__dashboard_mitarbeiter_export = staffLazy(() => import("@/components/staff/staff-export-screen").then((m) => ({ default: m.StaffExportScreen as ComponentType })));
const Lazy__dashboard_mitarbeiter_schichtplan = staffLazy(() => import("@/components/staff/shift-plan/staff-shift-plan-screen").then((m) => ({ default: m.StaffShiftPlanScreen as ComponentType })));
const Lazy__dashboard_mitarbeiter_statistiken = staffLazy(() => import("@/components/staff/staff-statistics-screen").then((m) => ({ default: m.StaffStatisticsScreen as ComponentType })));
const Lazy__dashboard_mitarbeiter_vertraege = staffLazy(() => import("@/components/staff/staff-contracts-screen").then((m) => ({ default: m.StaffContractsScreen as ComponentType })));
const Lazy__dashboard_news_autopilot = lazy(() => import("@/components/social/social-autopilot-screen").then((m) => ({ default: m.SocialAutopilotScreen as ComponentType })));
const Lazy__dashboard_news_einbinden = lazy(() => import("@/components/news/news-embed-panel").then((m) => ({ default: m.NewsEmbedPanel as ComponentType })));
const Lazy__dashboard_news_einstellungen = lazy(() => import("@/components/news/news-settings-panel").then((m) => ({ default: m.NewsSettingsPanel as ComponentType })));
const Lazy__dashboard_news_statistiken = lazy(() => import("@/components/news/news-statistics-screen").then((m) => ({ default: m.NewsStatisticsScreen as ComponentType })));
const Lazy__dashboard_pos_berichte = posLazy(() => import("@/components/pos/pos-reports-screen").then((m) => ({ default: m.PosReportsScreen as ComponentType })));
const Lazy__dashboard_pos_bestellungen = posLazy(() => import("@/components/pos/pos-orders-screen").then((m) => ({ default: m.PosOrdersScreen as ComponentType })));
const Lazy__dashboard_pos_einstellungen_bestand_storno = posLazy(() => import("@/components/pos/pos-settings-inventory-void-screen").then((m) => ({ default: m.PosSettingsInventoryVoidScreen as ComponentType })));
const Lazy__dashboard_pos_einstellungen_drucker_routing = posLazy(() => import("@/components/pos/pos-settings-printers-routing-screen").then((m) => ({ default: m.PosSettingsPrintersRoutingScreen as ComponentType })));
const Lazy__dashboard_pos_einstellungen_fiskal_zahlung = posLazy(() => import("@/components/pos/pos-settings-fiscal-payment-screen").then((m) => ({ default: m.PosSettingsFiscalPaymentScreen as ComponentType })));
const Lazy__dashboard_pos_einstellungen_geraete_rechte = posLazy(() => import("@/components/pos/pos-settings-devices-rights-screen").then((m) => ({ default: m.PosSettingsDevicesRightsScreen as ComponentType })));
const Lazy__dashboard_pos_einstellungen_geraete = posLazy(() => import("@/components/pos/restaurant-pos-devices-panel").then((m) => ({ default: m.RestaurantPosDevicesPanel as ComponentType })));
const Lazy__dashboard_pos_einstellungen_gutscheine = posLazy(() => import("@/components/pos/pos-settings-gift-vouchers-screen").then((m) => ({ default: m.PosSettingsGiftVouchersScreen as ComponentType })));
const Lazy__dashboard_pos_einstellungen_kueche = posLazy(() => import("@/components/pos/pos-settings-kitchen-screen").then((m) => ({ default: m.PosSettingsKitchenScreen as ComponentType })));
const Lazy__dashboard_pos_gutscheine = posLazy(() => import("@/components/pos/pos-gift-vouchers-screen").then((m) => ({ default: m.PosGiftVouchersScreen as ComponentType })));
const Lazy__dashboard_pos_quittungen = posLazy(() => import("@/components/pos/pos-receipts-screen").then((m) => ({ default: m.PosReceiptsScreen as ComponentType })));
const Lazy__dashboard_pos_statistiken = posLazy(() => import("@/components/pos/pos-statistics-screen").then((m) => ({ default: m.PosStatisticsScreen as ComponentType })));
const Lazy__dashboard_profile_anmeldung = profileLazy(() => import("@/components/profile/profile-anmeldung-screen").then((m) => ({ default: m.ProfileAnmeldungScreen as ComponentType })));
const Lazy__dashboard_profile_arbeitszeiten = profileLazy(() => import("@/components/profile/profile-work-hours-screen").then((m) => ({ default: m.ProfileWorkHoursScreen as ComponentType })));
const Lazy__dashboard_profile_benachrichtigungen = profileLazy(() => import("@/components/notifications/notification-preferences-panel").then((m) => ({ default: m.NotificationPreferencesPanel as ComponentType })));
const Lazy__dashboard_profile_dienstplan = profileLazy(() => import("@/components/profile/profile-shift-plan-screen").then((m) => ({ default: m.ProfileShiftPlanScreen as ComponentType })));
const Lazy__dashboard_profile_display_pin = profileLazy(() => import("@/components/profile/profile-display-pin-screen").then((m) => ({ default: m.ProfileDisplayPinScreen as ComponentType })));
const Lazy__dashboard_profile_dokumente = profileLazy(() => import("@/components/profile/profile-documents-screen").then((m) => ({ default: m.ProfileDocumentsScreen as ComponentType })));
const Lazy__dashboard_profile_persoenliche_daten = profileLazy(() => import("@/components/profile/profile-persoenliche-daten-screen").then((m) => ({ default: m.ProfilePersoenlicheDatenScreen as ComponentType })));
const Lazy__dashboard_profile_verfuegbarkeit = profileLazy(() => import("@/components/profile/profile-availability-screen").then((m) => ({ default: m.ProfileAvailabilityScreen as ComponentType })));
const Lazy__dashboard_reservierungen_einbinden = lazy(() => import("@/components/reservations/reservation-embed-panel").then((m) => ({ default: m.ReservationEmbedPanel as ComponentType })));
const Lazy__dashboard_reservierungen_einstellungen = lazy(() => import("@/components/reservations/reservation-settings-form").then((m) => ({ default: m.ReservationSettingsForm as ComponentType })));
const Lazy__dashboard_reservierungen_protokoll = lazy(() => import("@/components/reservations/reservations-protocol-screen").then((m) => ({ default: m.ReservationsProtocolScreen as ComponentType })));
const Lazy__dashboard_reservierungen_statistiken = lazy(() => import("@/components/reservations/reservations-statistics-screen").then((m) => ({ default: m.ReservationsStatisticsScreen as ComponentType })));
const Lazy__dashboard_reservierungen_tischplan = lazy(() => import("@/components/reservations/floor-plan-screen").then((m) => ({ default: m.FloorPlanScreen as ComponentType })));
const Lazy__dashboard_settings_abo = settingsLazy(() => import("@/components/settings/restaurant-billing-panel").then((m) => ({ default: m.RestaurantBillingPanel as ComponentType })));
const Lazy__dashboard_settings_api = settingsLazy(() => import("@/components/settings/restaurant-api-keys-panel").then((m) => ({ default: m.RestaurantApiKeysPanel as ComponentType })));
const Lazy__dashboard_settings_dashboard = settingsLazy(() => import("@/components/settings/dashboard-shortcuts-panel").then((m) => ({ default: m.DashboardShortcutsPanel as ComponentType })));
const Lazy__dashboard_settings_displays = settingsLazy(() => import("@/components/settings/restaurant-displays-panel").then((m) => ({ default: m.RestaurantDisplaysPanel as ComponentType })));
const Lazy__dashboard_settings_integrationen = settingsLazy(() => import("../routes/settings-integrationen-route").then((m) => ({ default: m.SettingsIntegrationenRoute as ComponentType })));
const Lazy__dashboard_settings_oeffnungszeiten_einbinden = settingsLazy(() => import("@/components/settings/opening-hours-embed-panel").then((m) => ({ default: m.OpeningHoursEmbedPanel as ComponentType })));
const Lazy__dashboard_settings_oeffnungszeiten = settingsLazy(() => import("../routes/settings-oeffnungszeiten-route").then((m) => ({ default: m.SettingsOeffnungszeitenRoute as ComponentType })));
const Lazy__dashboard_settings_restaurant = settingsLazy(() => import("../routes/settings-restaurant-route").then((m) => ({ default: m.SettingsRestaurantRoute as ComponentType })));
const Lazy__dashboard_settings_team = settingsLazy(() => import("@/components/settings/restaurant-team-settings-panel").then((m) => ({ default: m.RestaurantTeamSettingsPanel as ComponentType })));
const Lazy__dashboard_changelog = changelogLazy(() => import("@/components/changelog/changelog-overview").then((m) => ({ default: m.ChangelogOverview as ComponentType })));

export type DashboardRouteEntry = {
  path: string;
  fullPath: string;
  redirect?: string;
  keepAliveHome?: boolean;
  Lazy?: ReturnType<typeof lazy>;
};

export const DASHBOARD_ROUTE_ENTRIES: DashboardRouteEntry[] = [
  { path: "/bewertungen/einbinden", fullPath: "/dashboard/bewertungen/einbinden", Lazy: Lazy__dashboard_bewertungen_einbinden },
  { path: "/bewertungen/einstellungen", fullPath: "/dashboard/bewertungen/einstellungen", Lazy: Lazy__dashboard_bewertungen_einstellungen },
  { path: "/bewertungen/facebook", fullPath: "/dashboard/bewertungen/uebersicht?platform=facebook", redirect: "/dashboard/bewertungen/uebersicht?platform=facebook" },
  { path: "/bewertungen/google", fullPath: "/dashboard/bewertungen/uebersicht?platform=google", redirect: "/dashboard/bewertungen/uebersicht?platform=google" },
  { path: "/bewertungen/gwada", fullPath: "/dashboard/bewertungen/uebersicht?platform=gwada", redirect: "/dashboard/bewertungen/uebersicht?platform=gwada" },
  { path: "/bewertungen", fullPath: "/dashboard/bewertungen/uebersicht", redirect: "/dashboard/bewertungen/uebersicht" },
  { path: "/bewertungen/statistiken", fullPath: "/dashboard/bewertungen/statistiken", Lazy: Lazy__dashboard_bewertungen_statistiken },
  { path: "/bewertungen/uebersicht", fullPath: "/dashboard/bewertungen/uebersicht", keepAliveHome: true },
  { path: "/buchfuehrung/angebote", fullPath: "/dashboard/buchfuehrung/angebote", Lazy: Lazy__dashboard_buchfuehrung_angebote },
  { path: "/buchfuehrung/belege", fullPath: "/dashboard/buchfuehrung/belege", Lazy: Lazy__dashboard_buchfuehrung_belege },
  { path: "/buchfuehrung/einstellungen", fullPath: "/dashboard/buchfuehrung/einstellungen", Lazy: Lazy__dashboard_buchfuehrung_einstellungen },
  { path: "/buchfuehrung/kasse", fullPath: "/dashboard/buchfuehrung/kasse", Lazy: Lazy__dashboard_buchfuehrung_kasse },
  { path: "/buchfuehrung", fullPath: "/dashboard/buchfuehrung/rechnungen", redirect: "/dashboard/buchfuehrung/rechnungen" },
  { path: "/buchfuehrung/rechnungen", fullPath: "/dashboard/buchfuehrung/rechnungen", keepAliveHome: true },
  { path: "/buchfuehrung/statistiken", fullPath: "/dashboard/buchfuehrung/statistiken", Lazy: Lazy__dashboard_buchfuehrung_statistiken },
  { path: "/checklisten/einstellungen", fullPath: "/dashboard/checklisten/einstellungen", Lazy: Lazy__dashboard_checklisten_einstellungen },
  { path: "/checklisten/eintraege", fullPath: "/dashboard/checklisten/protokoll", redirect: "/dashboard/checklisten/protokoll" },
  { path: "/checklisten/geraete", fullPath: "/dashboard/checklisten", redirect: "/dashboard/checklisten" },
  { path: "/checklisten", fullPath: "/dashboard/checklisten", keepAliveHome: true },
  { path: "/checklisten/protokoll", fullPath: "/dashboard/checklisten/protokoll", Lazy: Lazy__dashboard_checklisten_protokoll },
  { path: "/checklisten/todos", fullPath: "/dashboard/checklisten", redirect: "/dashboard/checklisten" },
  { path: "/checklisten/vorlagen", fullPath: "/dashboard/checklisten", redirect: "/dashboard/checklisten" },
  { path: "/dokumente", fullPath: "/dashboard/dokumente/uebersicht", redirect: "/dashboard/dokumente/uebersicht" },
  { path: "/dokumente/protokoll", fullPath: "/dashboard/dokumente/protokoll", Lazy: Lazy__dashboard_dokumente_protokoll },
  { path: "/dokumente/statistiken", fullPath: "/dashboard/dokumente/statistiken", Lazy: Lazy__dashboard_dokumente_statistiken },
  { path: "/dokumente/uebersicht", fullPath: "/dashboard/dokumente/uebersicht", keepAliveHome: true },
  { path: "/events/einbinden", fullPath: "/dashboard/events/einbinden", Lazy: Lazy__dashboard_events_einbinden },
  { path: "/events/einstellungen", fullPath: "/dashboard/events/einstellungen", Lazy: Lazy__dashboard_events_einstellungen },
  { path: "/events", fullPath: "/dashboard/events/uebersicht", redirect: "/dashboard/events/uebersicht" },
  { path: "/events/statistiken", fullPath: "/dashboard/events/statistiken", Lazy: Lazy__dashboard_events_statistiken },
  { path: "/events/uebersicht", fullPath: "/dashboard/events/uebersicht", keepAliveHome: true },
  { path: "/galerie/einbinden", fullPath: "/dashboard/galerie/einbinden", Lazy: Lazy__dashboard_galerie_einbinden },
  { path: "/galerie/einstellungen", fullPath: "/dashboard/galerie/einstellungen", Lazy: Lazy__dashboard_galerie_einstellungen },
  { path: "/galerie", fullPath: "/dashboard/galerie/uebersicht", redirect: "/dashboard/galerie/uebersicht" },
  { path: "/galerie/statistiken", fullPath: "/dashboard/galerie/statistiken", Lazy: Lazy__dashboard_galerie_statistiken },
  { path: "/galerie/uebersicht", fullPath: "/dashboard/galerie/uebersicht", keepAliveHome: true },
  { path: "/insights", fullPath: "/dashboard/insights/uebersicht", redirect: "/dashboard/insights/uebersicht" },
  { path: "/insights/statistiken", fullPath: "/dashboard/insights/uebersicht", redirect: "/dashboard/insights/uebersicht" },
  { path: "/insights/uebersicht", fullPath: "/dashboard/insights/uebersicht", keepAliveHome: true },
  { path: "/inventory/bestellung", fullPath: "/dashboard/inventory/bestellung", Lazy: Lazy__dashboard_inventory_bestellung },
  { path: "/inventory", fullPath: "/dashboard/inventory/uebersicht", redirect: "/dashboard/inventory/uebersicht" },
  { path: "/inventory/statistiken", fullPath: "/dashboard/inventory/statistiken", Lazy: Lazy__dashboard_inventory_statistiken },
  { path: "/inventory/uebersicht", fullPath: "/dashboard/inventory/uebersicht", keepAliveHome: true },
  { path: "/kontakte/einstellungen", fullPath: "/dashboard/kontakte/einstellungen", Lazy: Lazy__dashboard_kontakte_einstellungen },
  { path: "/kontakte/export", fullPath: "/dashboard/kontakte/export", Lazy: Lazy__dashboard_kontakte_export },
  { path: "/kontakte/nachrichten", fullPath: "/dashboard/kontakte/nachrichten", keepAliveHome: true },
  { path: "/kontakte", fullPath: "/dashboard/kontakte/nachrichten?platform=all", redirect: "/dashboard/kontakte/nachrichten?platform=all" },
  { path: "/kontakte/statistiken", fullPath: "/dashboard/kontakte/statistiken", Lazy: Lazy__dashboard_kontakte_statistiken },
  { path: "/kontakte/uebersicht", fullPath: "/dashboard/kontakte/uebersicht", Lazy: Lazy__dashboard_kontakte_uebersicht },
  { path: "/menu/einbinden", fullPath: "/dashboard/menu/einbinden", Lazy: Lazy__dashboard_menu_einbinden },
  { path: "/menu/einstellungen", fullPath: "/dashboard/menu/einstellungen", Lazy: Lazy__dashboard_menu_einstellungen },
  { path: "/menu/export", fullPath: "/dashboard/menu/export", Lazy: Lazy__dashboard_menu_export },
  { path: "/menu", fullPath: "/dashboard/menu/uebersicht", redirect: "/dashboard/menu/uebersicht" },
  { path: "/menu/statistiken", fullPath: "/dashboard/menu/statistiken", Lazy: Lazy__dashboard_menu_statistiken },
  { path: "/menu/uebersicht", fullPath: "/dashboard/menu/uebersicht", keepAliveHome: true },
  { path: "/mitarbeiter/arbeitszeiten", fullPath: "/dashboard/mitarbeiter/arbeitszeiten", Lazy: Lazy__dashboard_mitarbeiter_arbeitszeiten },
  { path: "/mitarbeiter/dokumente", fullPath: "/dashboard/mitarbeiter/dokumente", Lazy: Lazy__dashboard_mitarbeiter_dokumente },
  { path: "/mitarbeiter/einstellungen", fullPath: "/dashboard/mitarbeiter/einstellungen", Lazy: Lazy__dashboard_mitarbeiter_einstellungen },
  { path: "/mitarbeiter/export", fullPath: "/dashboard/mitarbeiter/export", Lazy: Lazy__dashboard_mitarbeiter_export },
  { path: "/mitarbeiter", fullPath: "/dashboard/mitarbeiter/uebersicht", redirect: "/dashboard/mitarbeiter/uebersicht" },
  { path: "/mitarbeiter/schichtplan", fullPath: "/dashboard/mitarbeiter/schichtplan", Lazy: Lazy__dashboard_mitarbeiter_schichtplan },
  { path: "/mitarbeiter/statistiken", fullPath: "/dashboard/mitarbeiter/statistiken", Lazy: Lazy__dashboard_mitarbeiter_statistiken },
  { path: "/mitarbeiter/todos", fullPath: "/dashboard/checklisten", redirect: "/dashboard/checklisten" },
  { path: "/mitarbeiter/todos/protokoll", fullPath: "/dashboard/checklisten/protokoll", redirect: "/dashboard/checklisten/protokoll" },
  { path: "/mitarbeiter/uebersicht", fullPath: "/dashboard/mitarbeiter/uebersicht", keepAliveHome: true },
  { path: "/mitarbeiter/vertraege", fullPath: "/dashboard/mitarbeiter/vertraege", Lazy: Lazy__dashboard_mitarbeiter_vertraege },
  { path: "/news/autopilot", fullPath: "/dashboard/news/autopilot", Lazy: Lazy__dashboard_news_autopilot },
  { path: "/news/einbinden", fullPath: "/dashboard/news/einbinden", Lazy: Lazy__dashboard_news_einbinden },
  { path: "/news/einstellungen", fullPath: "/dashboard/news/einstellungen", Lazy: Lazy__dashboard_news_einstellungen },
  { path: "/news", fullPath: "/dashboard/news/uebersicht", redirect: "/dashboard/news/uebersicht" },
  { path: "/news/statistiken", fullPath: "/dashboard/news/statistiken", Lazy: Lazy__dashboard_news_statistiken },
  { path: "/news/uebersicht", fullPath: "/dashboard/news/uebersicht", keepAliveHome: true },
  { path: "/", fullPath: "/dashboard", keepAliveHome: true },
  { path: "/pos/berichte", fullPath: "/dashboard/pos/berichte", Lazy: Lazy__dashboard_pos_berichte },
  { path: "/pos/bestellungen", fullPath: "/dashboard/pos/bestellungen", Lazy: Lazy__dashboard_pos_bestellungen },
  { path: "/pos/einstellungen/bestand-storno", fullPath: "/dashboard/pos/einstellungen/bestand-storno", Lazy: Lazy__dashboard_pos_einstellungen_bestand_storno },
  { path: "/pos/einstellungen/drucker-routing", fullPath: "/dashboard/pos/einstellungen/drucker-routing", Lazy: Lazy__dashboard_pos_einstellungen_drucker_routing },
  { path: "/pos/einstellungen/fiskal-zahlung", fullPath: "/dashboard/pos/einstellungen/fiskal-zahlung", Lazy: Lazy__dashboard_pos_einstellungen_fiskal_zahlung },
  { path: "/pos/einstellungen/geraete-rechte", fullPath: "/dashboard/pos/einstellungen/geraete-rechte", Lazy: Lazy__dashboard_pos_einstellungen_geraete_rechte },
  { path: "/pos/einstellungen/geraete", fullPath: "/dashboard/pos/einstellungen/geraete", Lazy: Lazy__dashboard_pos_einstellungen_geraete },
  { path: "/pos/einstellungen/gutscheine", fullPath: "/dashboard/pos/einstellungen/gutscheine", Lazy: Lazy__dashboard_pos_einstellungen_gutscheine },
  { path: "/pos/einstellungen/kueche", fullPath: "/dashboard/pos/einstellungen/kueche", Lazy: Lazy__dashboard_pos_einstellungen_kueche },
  { path: "/pos/einstellungen", fullPath: "/dashboard/pos/einstellungen/fiskal-zahlung", redirect: "/dashboard/pos/einstellungen/fiskal-zahlung" },
  { path: "/pos/gutscheine", fullPath: "/dashboard/pos/gutscheine", Lazy: Lazy__dashboard_pos_gutscheine },
  { path: "/pos", fullPath: "/dashboard/pos/uebersicht", redirect: "/dashboard/pos/uebersicht" },
  { path: "/pos/quittungen", fullPath: "/dashboard/pos/quittungen", Lazy: Lazy__dashboard_pos_quittungen },
  { path: "/pos/statistiken", fullPath: "/dashboard/pos/statistiken", Lazy: Lazy__dashboard_pos_statistiken },
  { path: "/pos/uebersicht", fullPath: "/dashboard/pos/uebersicht", keepAliveHome: true },
  { path: "/profile/anmeldung", fullPath: "/dashboard/profile/anmeldung", Lazy: Lazy__dashboard_profile_anmeldung },
  { path: "/profile/arbeitszeiten", fullPath: "/dashboard/profile/arbeitszeiten", Lazy: Lazy__dashboard_profile_arbeitszeiten },
  { path: "/profile/benachrichtigungen", fullPath: "/dashboard/profile/benachrichtigungen", Lazy: Lazy__dashboard_profile_benachrichtigungen },
  { path: "/profile/dienstplan", fullPath: "/dashboard/profile/dienstplan", Lazy: Lazy__dashboard_profile_dienstplan },
  { path: "/profile/display-pin", fullPath: "/dashboard/profile/display-pin", Lazy: Lazy__dashboard_profile_display_pin },
  { path: "/profile/dokumente", fullPath: "/dashboard/profile/dokumente", Lazy: Lazy__dashboard_profile_dokumente },
  { path: "/profile", fullPath: "/dashboard/profile/persoenliche-daten", redirect: "/dashboard/profile/persoenliche-daten" },
  { path: "/profile/persoenliche-daten", fullPath: "/dashboard/profile/persoenliche-daten", Lazy: Lazy__dashboard_profile_persoenliche_daten },
  { path: "/profile/verfuegbarkeit", fullPath: "/dashboard/profile/verfuegbarkeit", Lazy: Lazy__dashboard_profile_verfuegbarkeit },
  { path: "/reservierungen/einbinden", fullPath: "/dashboard/reservierungen/einbinden", Lazy: Lazy__dashboard_reservierungen_einbinden },
  { path: "/reservierungen/einstellungen", fullPath: "/dashboard/reservierungen/einstellungen", Lazy: Lazy__dashboard_reservierungen_einstellungen },
  { path: "/reservierungen", fullPath: "/dashboard/reservierungen/uebersicht", redirect: "/dashboard/reservierungen/uebersicht" },
  { path: "/reservierungen/protokoll", fullPath: "/dashboard/reservierungen/protokoll", Lazy: Lazy__dashboard_reservierungen_protokoll },
  { path: "/reservierungen/statistiken", fullPath: "/dashboard/reservierungen/statistiken", Lazy: Lazy__dashboard_reservierungen_statistiken },
  { path: "/reservierungen/tischplan", fullPath: "/dashboard/reservierungen/tischplan", Lazy: Lazy__dashboard_reservierungen_tischplan },
  { path: "/reservierungen/uebersicht", fullPath: "/dashboard/reservierungen/uebersicht", keepAliveHome: true },
  { path: "/settings/abo", fullPath: "/dashboard/settings/abo", Lazy: Lazy__dashboard_settings_abo },
  { path: "/settings/api", fullPath: "/dashboard/settings/api", Lazy: Lazy__dashboard_settings_api },
  { path: "/settings/branding", fullPath: "/dashboard/settings/restaurant", redirect: "/dashboard/settings/restaurant" },
  { path: "/settings/dashboard", fullPath: "/dashboard/settings/dashboard", Lazy: Lazy__dashboard_settings_dashboard },
  { path: "/settings/displays", fullPath: "/dashboard/settings/displays", Lazy: Lazy__dashboard_settings_displays },
  { path: "/settings/eigenkontrolle/einstellungen", fullPath: "/dashboard/checklisten/einstellungen", redirect: "/dashboard/checklisten/einstellungen" },
  { path: "/settings/eigenkontrolle/eintraege", fullPath: "/dashboard/checklisten/protokoll", redirect: "/dashboard/checklisten/protokoll" },
  { path: "/settings/eigenkontrolle/geraete", fullPath: "/dashboard/checklisten", redirect: "/dashboard/checklisten" },
  { path: "/settings/eigenkontrolle", fullPath: "/dashboard/checklisten", redirect: "/dashboard/checklisten" },
  { path: "/settings/eigenkontrolle/protokoll", fullPath: "/dashboard/checklisten/protokoll", redirect: "/dashboard/checklisten/protokoll" },
  { path: "/settings/eigenkontrolle/vorlagen", fullPath: "/dashboard/checklisten", redirect: "/dashboard/checklisten" },
  { path: "/settings/integrationen", fullPath: "/dashboard/settings/integrationen", Lazy: Lazy__dashboard_settings_integrationen },
  { path: "/settings/kasse", fullPath: "/dashboard/pos/einstellungen/fiskal-zahlung", redirect: "/dashboard/pos/einstellungen/fiskal-zahlung" },
  { path: "/settings/oeffnungszeiten/einbinden", fullPath: "/dashboard/settings/oeffnungszeiten/einbinden", Lazy: Lazy__dashboard_settings_oeffnungszeiten_einbinden },
  { path: "/settings/oeffnungszeiten", fullPath: "/dashboard/settings/oeffnungszeiten", Lazy: Lazy__dashboard_settings_oeffnungszeiten },
  { path: "/settings", fullPath: "/dashboard/settings/restaurant", redirect: "/dashboard/settings/restaurant" },
  { path: "/settings/restaurant", fullPath: "/dashboard/settings/restaurant", Lazy: Lazy__dashboard_settings_restaurant },
  { path: "/settings/rollen", fullPath: "/dashboard/settings/team", redirect: "/dashboard/settings/team" },
  { path: "/settings/team", fullPath: "/dashboard/settings/team", Lazy: Lazy__dashboard_settings_team },
  { path: "/changelog", fullPath: "/dashboard/changelog", Lazy: Lazy__dashboard_changelog },
];
