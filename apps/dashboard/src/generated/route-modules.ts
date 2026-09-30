/** Auto-generated — run: node scripts/generate-dashboard-vite-routes.mjs
 * Profile/Settings/Staff/Changelog/POS/module subpages use chrome wrappers (layouts pruned with SPA).
 */
import { lazy, type ComponentType } from "react";
import { wrapChangelogPage } from "../routes/changelog-chrome";
import { wrapProfilePage } from "../routes/profile-chrome";
import { wrapSettingsPage } from "../routes/settings-chrome";
import { wrapStaffPage } from "../routes/staff-chrome";
import { moduleSubpageLazy } from "../routes/module-subpage-chrome";
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

const Lazy__dashboard_reviews_embed = lazy(moduleSubpageLazy("bewertungen", () => import("@/components/reviews/reviews-embed-panel").then((m) => ({ default: m.ReviewsEmbedPanel as ComponentType }))));
const Lazy__dashboard_reviews_settings = lazy(moduleSubpageLazy("bewertungen", () => import("@/components/reviews/reviews-settings-panel").then((m) => ({ default: m.ReviewsSettingsPanel as ComponentType }))));
const Lazy__dashboard_reviews_statistics = lazy(moduleSubpageLazy("bewertungen", () => import("@/components/reviews/reviews-statistics-screen").then((m) => ({ default: m.ReviewsStatisticsScreen as ComponentType }))));
const Lazy__dashboard_accounting_quotations = lazy(moduleSubpageLazy("buchfuehrung", () => import("@/components/accounting/accounting-quotations-screen").then((m) => ({ default: m.AccountingQuotationsScreen as ComponentType }))));
const Lazy__dashboard_accounting_vouchers = lazy(moduleSubpageLazy("buchfuehrung", () => import("@/components/accounting/accounting-vouchers-screen").then((m) => ({ default: m.AccountingVouchersScreen as ComponentType }))));
const Lazy__dashboard_accounting_settings = lazy(moduleSubpageLazy("buchfuehrung", () => import("@/components/accounting/accounting-settings-form").then((m) => ({ default: m.AccountingSettingsForm as ComponentType }))));
const Lazy__dashboard_accounting_cash_book = lazy(moduleSubpageLazy("buchfuehrung", () => import("@/components/accounting/accounting-cash-book-screen").then((m) => ({ default: m.AccountingCashBookScreen as ComponentType }))));
const Lazy__dashboard_accounting_statistics = lazy(moduleSubpageLazy("buchfuehrung", () => import("@/components/accounting/accounting-statistics-screen").then((m) => ({ default: m.AccountingStatisticsScreen as ComponentType }))));
const Lazy__dashboard_tasks_settings = lazy(moduleSubpageLazy("checklisten", () => import("@/components/checklisten/checklisten-settings-screen").then((m) => ({ default: m.ChecklistenSettingsScreen as ComponentType }))));
const Lazy__dashboard_tasks_log = lazy(moduleSubpageLazy("checklisten", () => import("@/components/checklisten/checklist-protocol-screen").then((m) => ({ default: m.ChecklistProtocolScreen as ComponentType }))));
const Lazy__dashboard_documents_log = lazy(moduleSubpageLazy("dokumente", () => import("@/components/documents/documents-protocol-screen").then((m) => ({ default: m.DocumentsProtocolScreen as ComponentType }))));
const Lazy__dashboard_documents_statistics = lazy(moduleSubpageLazy("dokumente", () => import("@/components/documents/documents-statistics-screen").then((m) => ({ default: m.DocumentsStatisticsScreen as ComponentType }))));
const Lazy__dashboard_events_embed = lazy(moduleSubpageLazy("events", () => import("@/components/events/events-embed-panel").then((m) => ({ default: m.EventsEmbedPanel as ComponentType }))));
const Lazy__dashboard_events_settings = lazy(moduleSubpageLazy("events", () => import("@/components/events/events-settings-panel").then((m) => ({ default: m.EventsSettingsPanel as ComponentType }))));
const Lazy__dashboard_events_statistics = lazy(moduleSubpageLazy("events", () => import("@/components/events/events-statistics-screen").then((m) => ({ default: m.EventsStatisticsScreen as ComponentType }))));
const Lazy__dashboard_gallery_embed = lazy(moduleSubpageLazy("galerie", () => import("@/components/gallery/gallery-embed-panel").then((m) => ({ default: m.GalleryEmbedPanel as ComponentType }))));
const Lazy__dashboard_gallery_settings = lazy(moduleSubpageLazy("galerie", () => import("@/components/gallery/gallery-settings-panel").then((m) => ({ default: m.GallerySettingsPanel as ComponentType }))));
const Lazy__dashboard_gallery_statistics = lazy(moduleSubpageLazy("galerie", () => import("@/components/gallery/gallery-statistics-screen").then((m) => ({ default: m.GalleryStatisticsScreen as ComponentType }))));
const Lazy__dashboard_inventory_purchase_orders = lazy(moduleSubpageLazy("inventory", () => import("@/components/inventory/purchase-orders-screen").then((m) => ({ default: m.PurchaseOrdersScreen as ComponentType }))));
const Lazy__dashboard_inventory_statistics = lazy(moduleSubpageLazy("inventory", () => import("@/components/inventory/inventory-statistics-screen").then((m) => ({ default: m.InventoryStatisticsScreen as ComponentType }))));
const Lazy__dashboard_contacts_settings = lazy(moduleSubpageLazy("kontakte", () => import("@/components/contacts/contact-settings-form").then((m) => ({ default: m.ContactSettingsForm as ComponentType }))));
const Lazy__dashboard_contacts_export = lazy(moduleSubpageLazy("kontakte", () => import("@/components/contacts/contacts-export-screen").then((m) => ({ default: m.ContactsExportScreen as ComponentType }))));
const Lazy__dashboard_contacts_statistics = lazy(moduleSubpageLazy("kontakte", () => import("@/components/contacts/contacts-statistics-screen").then((m) => ({ default: m.ContactsStatisticsScreen as ComponentType }))));
const Lazy__dashboard_contacts_overview = lazy(moduleSubpageLazy("kontakte", () => import("@/components/contacts/contacts-overview").then((m) => ({ default: m.ContactsOverview as ComponentType }))));
const Lazy__dashboard_menu_embed = lazy(moduleSubpageLazy("menu", () => import("@/components/menu/menu-embed-panel").then((m) => ({ default: m.MenuEmbedPanel as ComponentType }))));
const Lazy__dashboard_menu_settings = lazy(moduleSubpageLazy("menu", () => import("@/components/menu/menu-settings-form").then((m) => ({ default: m.MenuSettingsForm as ComponentType }))));
const Lazy__dashboard_menu_export = lazy(moduleSubpageLazy("menu", () => import("@/components/menu/menu-export-screen").then((m) => ({ default: m.MenuExportScreen as ComponentType }))));
const Lazy__dashboard_menu_statistics = lazy(moduleSubpageLazy("menu", () => import("@/components/menu/menu-statistics-screen").then((m) => ({ default: m.MenuStatisticsScreen as ComponentType }))));
const Lazy__dashboard_staff_work_hours = staffLazy(() => import("@/components/staff/staff-work-hours-screen").then((m) => ({ default: m.StaffWorkHoursScreen as ComponentType })));
const Lazy__dashboard_staff_documents = staffLazy(() => import("@/components/staff/staff-documents-screen").then((m) => ({ default: m.StaffDocumentsScreen as ComponentType })));
const Lazy__dashboard_staff_settings = staffLazy(() => import("@/components/staff/staff-settings-form").then((m) => ({ default: m.StaffSettingsForm as ComponentType })));
const Lazy__dashboard_staff_export = staffLazy(() => import("@/components/staff/staff-export-screen").then((m) => ({ default: m.StaffExportScreen as ComponentType })));
const Lazy__dashboard_staff_shift_plan = staffLazy(() => import("@/components/staff/shift-plan/staff-shift-plan-screen").then((m) => ({ default: m.StaffShiftPlanScreen as ComponentType })));
const Lazy__dashboard_staff_statistics = staffLazy(() => import("@/components/staff/staff-statistics-screen").then((m) => ({ default: m.StaffStatisticsScreen as ComponentType })));
const Lazy__dashboard_staff_contracts = staffLazy(() => import("@/components/staff/staff-contracts-screen").then((m) => ({ default: m.StaffContractsScreen as ComponentType })));
const Lazy__dashboard_news_autopilot = lazy(moduleSubpageLazy("news", () => import("@/components/social/social-autopilot-screen").then((m) => ({ default: m.SocialAutopilotScreen as ComponentType }))));
const Lazy__dashboard_news_embed = lazy(moduleSubpageLazy("news", () => import("@/components/news/news-embed-panel").then((m) => ({ default: m.NewsEmbedPanel as ComponentType }))));
const Lazy__dashboard_news_settings = lazy(moduleSubpageLazy("news", () => import("@/components/news/news-settings-panel").then((m) => ({ default: m.NewsSettingsPanel as ComponentType }))));
const Lazy__dashboard_news_statistics = lazy(moduleSubpageLazy("news", () => import("@/components/news/news-statistics-screen").then((m) => ({ default: m.NewsStatisticsScreen as ComponentType }))));
const Lazy__dashboard_pos_reports = posLazy(() => import("@/components/pos/pos-reports-screen").then((m) => ({ default: m.PosReportsScreen as ComponentType })));
const Lazy__dashboard_pos_orders = posLazy(() => import("@/components/pos/pos-orders-screen").then((m) => ({ default: m.PosOrdersScreen as ComponentType })));
const Lazy__dashboard_pos_settings_inventory_void = posLazy(() => import("@/components/pos/pos-settings-inventory-void-screen").then((m) => ({ default: m.PosSettingsInventoryVoidScreen as ComponentType })));
const Lazy__dashboard_pos_settings_printer_routing = posLazy(() => import("@/components/pos/pos-settings-printers-routing-screen").then((m) => ({ default: m.PosSettingsPrintersRoutingScreen as ComponentType })));
const Lazy__dashboard_pos_settings_fiscal_payment = posLazy(() => import("@/components/pos/pos-settings-fiscal-payment-screen").then((m) => ({ default: m.PosSettingsFiscalPaymentScreen as ComponentType })));
const Lazy__dashboard_pos_settings_device_permissions = posLazy(() => import("@/components/pos/pos-settings-devices-rights-screen").then((m) => ({ default: m.PosSettingsDevicesRightsScreen as ComponentType })));
const Lazy__dashboard_pos_settings_devices = posLazy(() => import("@/components/pos/restaurant-pos-devices-panel").then((m) => ({ default: m.RestaurantPosDevicesPanel as ComponentType })));
const Lazy__dashboard_pos_settings_gift_vouchers = posLazy(() => import("@/components/pos/pos-settings-gift-vouchers-screen").then((m) => ({ default: m.PosSettingsGiftVouchersScreen as ComponentType })));
const Lazy__dashboard_pos_settings_kitchen = posLazy(() => import("@/components/pos/pos-settings-kitchen-screen").then((m) => ({ default: m.PosSettingsKitchenScreen as ComponentType })));
const Lazy__dashboard_pos_gift_vouchers = posLazy(() => import("@/components/pos/pos-gift-vouchers-screen").then((m) => ({ default: m.PosGiftVouchersScreen as ComponentType })));
const Lazy__dashboard_pos_receipts = posLazy(() => import("@/components/pos/pos-receipts-screen").then((m) => ({ default: m.PosReceiptsScreen as ComponentType })));
const Lazy__dashboard_pos_statistics = posLazy(() => import("@/components/pos/pos-statistics-screen").then((m) => ({ default: m.PosStatisticsScreen as ComponentType })));
const Lazy__dashboard_profile_sign_in = profileLazy(() => import("@/components/profile/profile-anmeldung-screen").then((m) => ({ default: m.ProfileAnmeldungScreen as ComponentType })));
const Lazy__dashboard_profile_work_hours = profileLazy(() => import("@/components/profile/profile-work-hours-screen").then((m) => ({ default: m.ProfileWorkHoursScreen as ComponentType })));
const Lazy__dashboard_profile_notifications = profileLazy(() => import("@/components/notifications/notification-preferences-panel").then((m) => ({ default: m.NotificationPreferencesPanel as ComponentType })));
const Lazy__dashboard_profile_schedule = profileLazy(() => import("@/components/profile/profile-shift-plan-screen").then((m) => ({ default: m.ProfileShiftPlanScreen as ComponentType })));
const Lazy__dashboard_profile_display_pin = profileLazy(() => import("@/components/profile/profile-display-pin-screen").then((m) => ({ default: m.ProfileDisplayPinScreen as ComponentType })));
const Lazy__dashboard_profile_documents = profileLazy(() => import("@/components/profile/profile-documents-screen").then((m) => ({ default: m.ProfileDocumentsScreen as ComponentType })));
const Lazy__dashboard_profile_personal = profileLazy(() => import("@/components/profile/profile-persoenliche-daten-screen").then((m) => ({ default: m.ProfilePersoenlicheDatenScreen as ComponentType })));
const Lazy__dashboard_profile_availability = profileLazy(() => import("@/components/profile/profile-availability-screen").then((m) => ({ default: m.ProfileAvailabilityScreen as ComponentType })));
const Lazy__dashboard_reservations_embed = lazy(moduleSubpageLazy("reservierungen", () => import("@/components/reservations/reservation-embed-panel").then((m) => ({ default: m.ReservationEmbedPanel as ComponentType }))));
const Lazy__dashboard_reservations_settings = lazy(moduleSubpageLazy("reservierungen", () => import("@/components/reservations/reservation-settings-form").then((m) => ({ default: m.ReservationSettingsForm as ComponentType }))));
const Lazy__dashboard_reservations_log = lazy(moduleSubpageLazy("reservierungen", () => import("@/components/reservations/reservations-protocol-screen").then((m) => ({ default: m.ReservationsProtocolScreen as ComponentType }))));
const Lazy__dashboard_reservations_statistics = lazy(moduleSubpageLazy("reservierungen", () => import("@/components/reservations/reservations-statistics-screen").then((m) => ({ default: m.ReservationsStatisticsScreen as ComponentType }))));
const Lazy__dashboard_reservations_floor_plan = lazy(moduleSubpageLazy("reservierungen", () => import("@/components/reservations/floor-plan-screen").then((m) => ({ default: m.FloorPlanScreen as ComponentType }))));
const Lazy__dashboard_settings_billing = settingsLazy(() => import("@/components/settings/restaurant-billing-panel").then((m) => ({ default: m.RestaurantBillingPanel as ComponentType })));
const Lazy__dashboard_settings_api = settingsLazy(() => import("@/components/settings/restaurant-api-keys-panel").then((m) => ({ default: m.RestaurantApiKeysPanel as ComponentType })));
const Lazy__dashboard_settings_dashboard = settingsLazy(() => import("@/components/settings/dashboard-shortcuts-panel").then((m) => ({ default: m.DashboardShortcutsPanel as ComponentType })));
const Lazy__dashboard_settings_displays = settingsLazy(() => import("@/components/settings/restaurant-displays-panel").then((m) => ({ default: m.RestaurantDisplaysPanel as ComponentType })));
const Lazy__dashboard_settings_integrations = settingsLazy(() => import("../routes/settings-integrationen-route").then((m) => ({ default: m.SettingsIntegrationenRoute as ComponentType })));
const Lazy__dashboard_settings_opening_hours_embed = settingsLazy(() => import("@/components/settings/opening-hours-embed-panel").then((m) => ({ default: m.OpeningHoursEmbedPanel as ComponentType })));
const Lazy__dashboard_settings_opening_hours = settingsLazy(() => import("../routes/settings-oeffnungszeiten-route").then((m) => ({ default: m.SettingsOeffnungszeitenRoute as ComponentType })));
const Lazy__dashboard_settings_restaurant = settingsLazy(() => import("../routes/settings-restaurant-route").then((m) => ({ default: m.SettingsRestaurantRoute as ComponentType })));
const Lazy__dashboard_settings_team = settingsLazy(() => import("@/components/settings/restaurant-team-settings-panel").then((m) => ({ default: m.RestaurantTeamSettingsPanel as ComponentType })));
const Lazy__dashboard_changelog = changelogLazy(() => import("@/components/changelog/changelog-overview").then((m) => ({ default: m.ChangelogOverview as ComponentType })));
const Lazy__dashboard_staff_work_hours_fix = staffLazy(() => import("@/components/staff/staff-labor-compliance-screen").then((m) => ({ default: m.StaffLaborComplianceScreen as ComponentType })));
const Lazy__dashboard_staff_work_hours_payroll = staffLazy(() => import("@/components/staff/staff-payroll-settlement-screen").then((m) => ({ default: m.StaffPayrollSettlementScreen as ComponentType })));
const Lazy__dashboard_tasks_mine = lazy(moduleSubpageLazy("checklisten", () => import("@/components/checklisten/aufgaben-meine-screen").then((m) => ({ default: m.AufgabenMeineScreen as ComponentType }))));
const Lazy__dashboard_tasks_messages = lazy(moduleSubpageLazy("checklisten", () => import("@/components/checklisten/aufgaben-nachrichten-screen").then((m) => ({ default: m.AufgabenNachrichtenScreen as ComponentType }))));

export type DashboardRouteEntry = {
  path: string;
  fullPath: string;
  redirect?: string;
  keepAliveHome?: boolean;
  Lazy?: ReturnType<typeof lazy>;
};

export const DASHBOARD_ROUTE_ENTRIES: DashboardRouteEntry[] = [
  { path: "/reviews/embed", fullPath: "/dashboard/reviews/embed", Lazy: Lazy__dashboard_reviews_embed },
  { path: "/reviews/settings", fullPath: "/dashboard/reviews/settings", Lazy: Lazy__dashboard_reviews_settings },
  { path: "/reviews/facebook", fullPath: "/dashboard/reviews/overview?platform=facebook", redirect: "/dashboard/reviews/overview?platform=facebook" },
  { path: "/reviews/google", fullPath: "/dashboard/reviews/overview?platform=google", redirect: "/dashboard/reviews/overview?platform=google" },
  { path: "/reviews/gwada", fullPath: "/dashboard/reviews/overview?platform=gwada", redirect: "/dashboard/reviews/overview?platform=gwada" },
  { path: "/reviews", fullPath: "/dashboard/reviews/overview", redirect: "/dashboard/reviews/overview" },
  { path: "/reviews/statistics", fullPath: "/dashboard/reviews/statistics", Lazy: Lazy__dashboard_reviews_statistics },
  { path: "/reviews/overview", fullPath: "/dashboard/reviews/overview", keepAliveHome: true },
  { path: "/accounting/quotations", fullPath: "/dashboard/accounting/quotations", Lazy: Lazy__dashboard_accounting_quotations },
  { path: "/accounting/vouchers", fullPath: "/dashboard/accounting/vouchers", Lazy: Lazy__dashboard_accounting_vouchers },
  { path: "/accounting/settings", fullPath: "/dashboard/accounting/settings", Lazy: Lazy__dashboard_accounting_settings },
  { path: "/accounting/cash-book", fullPath: "/dashboard/accounting/cash-book", Lazy: Lazy__dashboard_accounting_cash_book },
  { path: "/accounting", fullPath: "/dashboard/accounting/invoices", redirect: "/dashboard/accounting/invoices" },
  { path: "/accounting/invoices", fullPath: "/dashboard/accounting/invoices", keepAliveHome: true },
  { path: "/accounting/statistics", fullPath: "/dashboard/accounting/statistics", Lazy: Lazy__dashboard_accounting_statistics },
  { path: "/tasks/settings", fullPath: "/dashboard/tasks/settings", Lazy: Lazy__dashboard_tasks_settings },
  { path: "/tasks/entries", fullPath: "/dashboard/tasks/log", redirect: "/dashboard/tasks/log" },
  { path: "/tasks/devices", fullPath: "/dashboard/tasks", redirect: "/dashboard/tasks" },
  { path: "/tasks", fullPath: "/dashboard/tasks", keepAliveHome: true },
  { path: "/tasks/log", fullPath: "/dashboard/tasks/log", Lazy: Lazy__dashboard_tasks_log },
  { path: "/tasks/todos", fullPath: "/dashboard/tasks", redirect: "/dashboard/tasks" },
  { path: "/tasks/templates", fullPath: "/dashboard/tasks", redirect: "/dashboard/tasks" },
  { path: "/documents", fullPath: "/dashboard/documents/overview", redirect: "/dashboard/documents/overview" },
  { path: "/documents/log", fullPath: "/dashboard/documents/log", Lazy: Lazy__dashboard_documents_log },
  { path: "/documents/statistics", fullPath: "/dashboard/documents/statistics", Lazy: Lazy__dashboard_documents_statistics },
  { path: "/documents/overview", fullPath: "/dashboard/documents/overview", keepAliveHome: true },
  { path: "/events/embed", fullPath: "/dashboard/events/embed", Lazy: Lazy__dashboard_events_embed },
  { path: "/events/settings", fullPath: "/dashboard/events/settings", Lazy: Lazy__dashboard_events_settings },
  { path: "/events", fullPath: "/dashboard/events/overview", redirect: "/dashboard/events/overview" },
  { path: "/events/statistics", fullPath: "/dashboard/events/statistics", Lazy: Lazy__dashboard_events_statistics },
  { path: "/events/overview", fullPath: "/dashboard/events/overview", keepAliveHome: true },
  { path: "/gallery/embed", fullPath: "/dashboard/gallery/embed", Lazy: Lazy__dashboard_gallery_embed },
  { path: "/gallery/settings", fullPath: "/dashboard/gallery/settings", Lazy: Lazy__dashboard_gallery_settings },
  { path: "/gallery", fullPath: "/dashboard/gallery/overview", redirect: "/dashboard/gallery/overview" },
  { path: "/gallery/statistics", fullPath: "/dashboard/gallery/statistics", Lazy: Lazy__dashboard_gallery_statistics },
  { path: "/gallery/overview", fullPath: "/dashboard/gallery/overview", keepAliveHome: true },
  { path: "/insights", fullPath: "/dashboard/insights/overview", redirect: "/dashboard/insights/overview" },
  { path: "/insights/statistics", fullPath: "/dashboard/insights/overview", redirect: "/dashboard/insights/overview" },
  { path: "/insights/overview", fullPath: "/dashboard/insights/overview", keepAliveHome: true },
  { path: "/inventory/purchase-orders", fullPath: "/dashboard/inventory/purchase-orders", Lazy: Lazy__dashboard_inventory_purchase_orders },
  { path: "/inventory", fullPath: "/dashboard/inventory/overview", redirect: "/dashboard/inventory/overview" },
  { path: "/inventory/statistics", fullPath: "/dashboard/inventory/statistics", Lazy: Lazy__dashboard_inventory_statistics },
  { path: "/inventory/overview", fullPath: "/dashboard/inventory/overview", keepAliveHome: true },
  { path: "/contacts/settings", fullPath: "/dashboard/contacts/settings", Lazy: Lazy__dashboard_contacts_settings },
  { path: "/contacts/export", fullPath: "/dashboard/contacts/export", Lazy: Lazy__dashboard_contacts_export },
  { path: "/contacts/messages", fullPath: "/dashboard/contacts/messages", keepAliveHome: true },
  { path: "/contacts", fullPath: "/dashboard/contacts/messages?platform=all", redirect: "/dashboard/contacts/messages?platform=all" },
  { path: "/contacts/statistics", fullPath: "/dashboard/contacts/statistics", Lazy: Lazy__dashboard_contacts_statistics },
  { path: "/contacts/overview", fullPath: "/dashboard/contacts/overview", Lazy: Lazy__dashboard_contacts_overview },
  { path: "/menu/embed", fullPath: "/dashboard/menu/embed", Lazy: Lazy__dashboard_menu_embed },
  { path: "/menu/settings", fullPath: "/dashboard/menu/settings", Lazy: Lazy__dashboard_menu_settings },
  { path: "/menu/export", fullPath: "/dashboard/menu/export", Lazy: Lazy__dashboard_menu_export },
  { path: "/menu", fullPath: "/dashboard/menu/overview", redirect: "/dashboard/menu/overview" },
  { path: "/menu/statistics", fullPath: "/dashboard/menu/statistics", Lazy: Lazy__dashboard_menu_statistics },
  { path: "/menu/overview", fullPath: "/dashboard/menu/overview", keepAliveHome: true },
  { path: "/staff/work-hours", fullPath: "/dashboard/staff/work-hours", Lazy: Lazy__dashboard_staff_work_hours },
  { path: "/staff/documents", fullPath: "/dashboard/staff/documents", Lazy: Lazy__dashboard_staff_documents },
  { path: "/staff/settings", fullPath: "/dashboard/staff/settings", Lazy: Lazy__dashboard_staff_settings },
  { path: "/staff/export", fullPath: "/dashboard/staff/export", Lazy: Lazy__dashboard_staff_export },
  { path: "/staff", fullPath: "/dashboard/staff/overview", redirect: "/dashboard/staff/overview" },
  { path: "/staff/shift-plan", fullPath: "/dashboard/staff/shift-plan", Lazy: Lazy__dashboard_staff_shift_plan },
  { path: "/staff/statistics", fullPath: "/dashboard/staff/statistics", Lazy: Lazy__dashboard_staff_statistics },
  { path: "/staff/todos", fullPath: "/dashboard/tasks", redirect: "/dashboard/tasks" },
  { path: "/staff/todos/log", fullPath: "/dashboard/tasks/log", redirect: "/dashboard/tasks/log" },
  { path: "/staff/overview", fullPath: "/dashboard/staff/overview", keepAliveHome: true },
  { path: "/staff/contracts", fullPath: "/dashboard/staff/contracts", Lazy: Lazy__dashboard_staff_contracts },
  { path: "/news/autopilot", fullPath: "/dashboard/news/autopilot", Lazy: Lazy__dashboard_news_autopilot },
  { path: "/news/embed", fullPath: "/dashboard/news/embed", Lazy: Lazy__dashboard_news_embed },
  { path: "/news/settings", fullPath: "/dashboard/news/settings", Lazy: Lazy__dashboard_news_settings },
  { path: "/news", fullPath: "/dashboard/news/overview", redirect: "/dashboard/news/overview" },
  { path: "/news/statistics", fullPath: "/dashboard/news/statistics", Lazy: Lazy__dashboard_news_statistics },
  { path: "/news/overview", fullPath: "/dashboard/news/overview", keepAliveHome: true },
  { path: "/", fullPath: "/dashboard", keepAliveHome: true },
  { path: "/pos/reports", fullPath: "/dashboard/pos/reports", Lazy: Lazy__dashboard_pos_reports },
  { path: "/pos/orders", fullPath: "/dashboard/pos/orders", Lazy: Lazy__dashboard_pos_orders },
  { path: "/pos/settings/inventory-void", fullPath: "/dashboard/pos/settings/inventory-void", Lazy: Lazy__dashboard_pos_settings_inventory_void },
  { path: "/pos/settings/printer-routing", fullPath: "/dashboard/pos/settings/printer-routing", Lazy: Lazy__dashboard_pos_settings_printer_routing },
  { path: "/pos/settings/fiscal-payment", fullPath: "/dashboard/pos/settings/fiscal-payment", Lazy: Lazy__dashboard_pos_settings_fiscal_payment },
  { path: "/pos/settings/device-permissions", fullPath: "/dashboard/pos/settings/device-permissions", Lazy: Lazy__dashboard_pos_settings_device_permissions },
  { path: "/pos/settings/devices", fullPath: "/dashboard/pos/settings/devices", Lazy: Lazy__dashboard_pos_settings_devices },
  { path: "/pos/settings/gift-vouchers", fullPath: "/dashboard/pos/settings/gift-vouchers", Lazy: Lazy__dashboard_pos_settings_gift_vouchers },
  { path: "/pos/settings/kitchen", fullPath: "/dashboard/pos/settings/kitchen", Lazy: Lazy__dashboard_pos_settings_kitchen },
  { path: "/pos/settings", fullPath: "/dashboard/pos/settings/fiscal-payment", redirect: "/dashboard/pos/settings/fiscal-payment" },
  { path: "/pos/gift-vouchers", fullPath: "/dashboard/pos/gift-vouchers", Lazy: Lazy__dashboard_pos_gift_vouchers },
  { path: "/pos", fullPath: "/dashboard/pos/overview", redirect: "/dashboard/pos/overview" },
  { path: "/pos/receipts", fullPath: "/dashboard/pos/receipts", Lazy: Lazy__dashboard_pos_receipts },
  { path: "/pos/statistics", fullPath: "/dashboard/pos/statistics", Lazy: Lazy__dashboard_pos_statistics },
  { path: "/pos/overview", fullPath: "/dashboard/pos/overview", keepAliveHome: true },
  { path: "/profile/sign-in", fullPath: "/dashboard/profile/sign-in", Lazy: Lazy__dashboard_profile_sign_in },
  { path: "/profile/work-hours", fullPath: "/dashboard/profile/work-hours", Lazy: Lazy__dashboard_profile_work_hours },
  { path: "/profile/notifications", fullPath: "/dashboard/profile/notifications", Lazy: Lazy__dashboard_profile_notifications },
  { path: "/profile/schedule", fullPath: "/dashboard/profile/schedule", Lazy: Lazy__dashboard_profile_schedule },
  { path: "/profile/display-pin", fullPath: "/dashboard/profile/display-pin", Lazy: Lazy__dashboard_profile_display_pin },
  { path: "/profile/documents", fullPath: "/dashboard/profile/documents", Lazy: Lazy__dashboard_profile_documents },
  { path: "/profile", fullPath: "/dashboard/profile/personal", redirect: "/dashboard/profile/personal" },
  { path: "/profile/personal", fullPath: "/dashboard/profile/personal", Lazy: Lazy__dashboard_profile_personal },
  { path: "/profile/availability", fullPath: "/dashboard/profile/availability", Lazy: Lazy__dashboard_profile_availability },
  { path: "/reservations/embed", fullPath: "/dashboard/reservations/embed", Lazy: Lazy__dashboard_reservations_embed },
  { path: "/reservations/settings", fullPath: "/dashboard/reservations/settings", Lazy: Lazy__dashboard_reservations_settings },
  { path: "/reservations", fullPath: "/dashboard/reservations/overview", redirect: "/dashboard/reservations/overview" },
  { path: "/reservations/log", fullPath: "/dashboard/reservations/log", Lazy: Lazy__dashboard_reservations_log },
  { path: "/reservations/statistics", fullPath: "/dashboard/reservations/statistics", Lazy: Lazy__dashboard_reservations_statistics },
  { path: "/reservations/floor-plan", fullPath: "/dashboard/reservations/floor-plan", Lazy: Lazy__dashboard_reservations_floor_plan },
  { path: "/reservations/overview", fullPath: "/dashboard/reservations/overview", keepAliveHome: true },
  { path: "/settings/billing", fullPath: "/dashboard/settings/billing", Lazy: Lazy__dashboard_settings_billing },
  { path: "/settings/api", fullPath: "/dashboard/settings/api", Lazy: Lazy__dashboard_settings_api },
  { path: "/settings/branding", fullPath: "/dashboard/settings/restaurant", redirect: "/dashboard/settings/restaurant" },
  { path: "/settings/dashboard", fullPath: "/dashboard/settings/dashboard", Lazy: Lazy__dashboard_settings_dashboard },
  { path: "/settings/displays", fullPath: "/dashboard/settings/displays", Lazy: Lazy__dashboard_settings_displays },
  { path: "/settings/eigenkontrolle/settings", fullPath: "/dashboard/tasks/settings", redirect: "/dashboard/tasks/settings" },
  { path: "/settings/eigenkontrolle/entries", fullPath: "/dashboard/tasks/log", redirect: "/dashboard/tasks/log" },
  { path: "/settings/eigenkontrolle/devices", fullPath: "/dashboard/tasks", redirect: "/dashboard/tasks" },
  { path: "/settings/eigenkontrolle", fullPath: "/dashboard/tasks", redirect: "/dashboard/tasks" },
  { path: "/settings/eigenkontrolle/log", fullPath: "/dashboard/tasks/log", redirect: "/dashboard/tasks/log" },
  { path: "/settings/eigenkontrolle/templates", fullPath: "/dashboard/tasks", redirect: "/dashboard/tasks" },
  { path: "/settings/integrations", fullPath: "/dashboard/settings/integrations", Lazy: Lazy__dashboard_settings_integrations },
  { path: "/settings/kasse", fullPath: "/dashboard/pos/settings/fiscal-payment", redirect: "/dashboard/pos/settings/fiscal-payment" },
  { path: "/settings/opening-hours/embed", fullPath: "/dashboard/settings/opening-hours/embed", Lazy: Lazy__dashboard_settings_opening_hours_embed },
  { path: "/settings/opening-hours", fullPath: "/dashboard/settings/opening-hours", Lazy: Lazy__dashboard_settings_opening_hours },
  { path: "/settings", fullPath: "/dashboard/settings/restaurant", redirect: "/dashboard/settings/restaurant" },
  { path: "/settings/restaurant", fullPath: "/dashboard/settings/restaurant", Lazy: Lazy__dashboard_settings_restaurant },
  { path: "/settings/rollen", fullPath: "/dashboard/settings/team", redirect: "/dashboard/settings/team" },
  { path: "/settings/team", fullPath: "/dashboard/settings/team", Lazy: Lazy__dashboard_settings_team },
  { path: "/changelog", fullPath: "/dashboard/changelog", Lazy: Lazy__dashboard_changelog },
  { path: "/staff/work-hours/fix", fullPath: "/dashboard/staff/work-hours/fix", Lazy: Lazy__dashboard_staff_work_hours_fix },
  { path: "/staff/work-hours/payroll", fullPath: "/dashboard/staff/work-hours/payroll", Lazy: Lazy__dashboard_staff_work_hours_payroll },
  { path: "/tasks/mine", fullPath: "/dashboard/tasks/mine", Lazy: Lazy__dashboard_tasks_mine },
  { path: "/tasks/messages", fullPath: "/dashboard/tasks/messages", Lazy: Lazy__dashboard_tasks_messages },
  { path: "/tasks/eigenkontrolle", fullPath: "/dashboard/tasks", redirect: "/dashboard/tasks" },
];
