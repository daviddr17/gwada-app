import "server-only";

import { normalizeAppLocale, type AppLocale } from "@/i18n/config";
import {
  toolSendContactMessage,
  toolUpdateStaff,
  toolUpsertMenuItem,
} from "@/lib/assistant/assistant-entity-write-tools";
import {
  toolContentFeed,
  toolInboxSummary,
  toolPurchaseOrders,
  toolRestaurantStats,
  toolReviewsSummary,
  toolSearchContacts,
  toolSearchMenu,
  toolStaffShifts,
} from "@/lib/assistant/assistant-module-read-tools";
import {
  toolAdjustIngredientStock,
  toolSetMenuItemActive,
  toolSetPurchaseOrderStatus,
  toolUpdateReservation,
} from "@/lib/assistant/assistant-module-write-tools";
import {
  toolOpenAmounts,
  toolServiceToday,
  toolStaffOnShift,
  toolStock,
} from "@/lib/assistant/assistant-ops-tools";
import {
  toolSyncPlatforms,
  toolUpdateOpeningHours,
} from "@/lib/assistant/assistant-settings-tools";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import {
  toolCountReservations,
  toolCreateReservation,
  toolGetRestaurantRules,
  toolSearchHandbook,
} from "@/lib/assistant/assistant-tools";

export async function runAssistantToolByName(
  ctx: AssistantToolContext,
  name: string,
  argsJson: string,
  locale: AppLocale,
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    return JSON.stringify({ ok: false, error: "Ungültige Tool-Argumente." });
  }

  delete args.restaurant_id;
  delete args.restaurantId;

  switch (name) {
    case "count_reservations":
      return toolCountReservations(
        ctx,
        {
          start_ymd: args.start_ymd == null ? undefined : String(args.start_ymd),
          end_ymd: args.end_ymd == null ? undefined : String(args.end_ymd),
          date_ymd: args.date_ymd == null ? undefined : String(args.date_ymd),
          scope: args.scope == null ? undefined : String(args.scope),
          restaurant_name:
            args.restaurant_name == null ? undefined : String(args.restaurant_name),
        },
        normalizeAppLocale(locale),
      );
    case "search_handbook":
      return toolSearchHandbook(ctx, { query: String(args.query ?? "") });
    case "get_restaurant_rules":
      return toolGetRestaurantRules(ctx, {
        locale,
        scope: args.scope == null ? undefined : String(args.scope),
        restaurant_name:
          args.restaurant_name == null ? undefined : String(args.restaurant_name),
      });
    case "create_reservation":
      return toolCreateReservation(
        ctx,
        {
          date_ymd: String(args.date_ymd ?? ""),
          time_hm: String(args.time_hm ?? ""),
          party_size: Number(args.party_size),
          guest_first_name: String(args.guest_first_name ?? ""),
          guest_last_name:
            args.guest_last_name == null ? null : String(args.guest_last_name),
          guest_phone: args.guest_phone == null ? null : String(args.guest_phone),
          notes: args.notes == null ? null : String(args.notes),
          confirm: false,
          scope: args.scope == null ? undefined : String(args.scope),
          restaurant_name:
            args.restaurant_name == null ? undefined : String(args.restaurant_name),
        },
        locale,
      );
    case "update_reservation":
      return toolUpdateReservation(ctx, { ...args, confirm: false }, locale);
    case "service_today":
      return toolServiceToday(ctx, args, locale);
    case "stock":
      return toolStock(ctx, args, locale);
    case "adjust_ingredient_stock":
      return toolAdjustIngredientStock(ctx, { ...args, confirm: false }, locale);
    case "staff_on_shift":
      return toolStaffOnShift(ctx, args, locale);
    case "staff_shifts":
      return toolStaffShifts(ctx, args, locale);
    case "open_amounts":
      return toolOpenAmounts(ctx, args, locale);
    case "update_opening_hours":
      return toolUpdateOpeningHours(ctx, { ...args, confirm: false }, locale);
    case "sync_platforms":
      return toolSyncPlatforms(ctx, { ...args, confirm: false }, locale);
    case "search_menu":
      return toolSearchMenu(ctx, args, locale);
    case "set_menu_item_active":
      return toolSetMenuItemActive(ctx, { ...args, confirm: false }, locale);
    case "upsert_menu_item":
      return toolUpsertMenuItem(ctx, { ...args, confirm: false }, locale);
    case "update_staff":
      return toolUpdateStaff(ctx, { ...args, confirm: false }, locale);
    case "send_contact_message":
      return toolSendContactMessage(ctx, { ...args, confirm: false }, locale);
    case "purchase_orders":
      return toolPurchaseOrders(ctx, args, locale);
    case "set_purchase_order_status":
      return toolSetPurchaseOrderStatus(ctx, { ...args, confirm: false }, locale);
    case "search_contacts":
      return toolSearchContacts(ctx, args, locale);
    case "inbox_summary":
      return toolInboxSummary(ctx, args, locale);
    case "reviews_summary":
      return toolReviewsSummary(ctx, args, locale);
    case "content_feed":
      return toolContentFeed(ctx, args, locale);
    case "restaurant_stats":
      return toolRestaurantStats(ctx, args, locale);
    default:
      return JSON.stringify({ ok: false, error: `Unbekanntes Tool: ${name}` });
  }
}
