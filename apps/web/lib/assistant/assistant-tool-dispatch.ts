import "server-only";

import { normalizeAppLocale, type AppLocale } from "@/i18n/config";
import {
  toolSendContactMessage,
  toolUpdateStaff,
  toolUpsertMenuItem,
} from "@/lib/assistant/assistant-entity-write-tools";
import {
  toolAddDocumentNote,
  toolCreateCashBookEntry,
  toolCreateComplianceRecord,
  toolCreatePurchaseOrder,
  toolCreateStaff,
  toolDeleteContact,
  toolDeleteMenuItem,
  toolDeleteStaff,
  toolDeleteStaffShift,
  toolListCompliance,
  toolListDocuments,
  toolListGuides,
  toolListStaffTodos,
  toolMarkContactThreadRead,
  toolMarkReviewRead,
  toolReadContactThread,
  toolReplyToReview,
  toolUpdateRestaurantStammdaten,
  toolUpsertContact,
  toolUpsertEvent,
  toolUpsertIngredient,
  toolUpsertMenuCategory,
  toolUpsertMenuTag,
  toolUpsertNewsPost,
  toolUpsertStaffShift,
  toolUpsertStaffTodo,
} from "@/lib/assistant/assistant-full-ops-tools";
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
} from "@/lib/assistant/assistant-module-write-tools";
import {
  toolDeleteReservation,
  toolResolveReservationChangeRequest,
  toolSetReservationDayNote,
  toolUpdateReservation,
} from "@/lib/assistant/assistant-reservation-write-tools";
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

type ToolFn = (
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
) => Promise<string>;

const WRITE_FORCE_CONFIRM_FALSE: ToolFn = async (ctx, args, locale) => {
  void ctx;
  void args;
  void locale;
  return JSON.stringify({ ok: false, error: "internal" });
};

function asWrite(fn: ToolFn): ToolFn {
  return (ctx, args, locale) => fn(ctx, { ...args, confirm: false }, locale);
}

const TOOLS: Record<string, ToolFn> = {
  count_reservations: async (ctx, args, locale) =>
    toolCountReservations(
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
    ),
  search_handbook: async (ctx, args) =>
    toolSearchHandbook(ctx, { query: String(args.query ?? "") }),
  get_restaurant_rules: async (ctx, args, locale) =>
    toolGetRestaurantRules(ctx, {
      locale,
      scope: args.scope == null ? undefined : String(args.scope),
      restaurant_name:
        args.restaurant_name == null ? undefined : String(args.restaurant_name),
    }),
  create_reservation: async (ctx, args, locale) =>
    toolCreateReservation(
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
    ),
  update_reservation: asWrite(toolUpdateReservation),
  delete_reservation: asWrite(toolDeleteReservation),
  set_reservation_day_note: asWrite(toolSetReservationDayNote),
  resolve_reservation_change_request: asWrite(
    toolResolveReservationChangeRequest,
  ),
  service_today: toolServiceToday,
  stock: toolStock,
  adjust_ingredient_stock: asWrite(toolAdjustIngredientStock),
  staff_on_shift: toolStaffOnShift,
  staff_shifts: toolStaffShifts,
  open_amounts: toolOpenAmounts,
  update_opening_hours: asWrite(toolUpdateOpeningHours),
  sync_platforms: asWrite(toolSyncPlatforms),
  search_menu: toolSearchMenu,
  set_menu_item_active: asWrite(toolSetMenuItemActive),
  upsert_menu_item: asWrite(toolUpsertMenuItem),
  update_staff: asWrite(toolUpdateStaff),
  send_contact_message: asWrite(toolSendContactMessage),
  purchase_orders: toolPurchaseOrders,
  set_purchase_order_status: asWrite(toolSetPurchaseOrderStatus),
  search_contacts: toolSearchContacts,
  inbox_summary: toolInboxSummary,
  reviews_summary: toolReviewsSummary,
  content_feed: toolContentFeed,
  restaurant_stats: toolRestaurantStats,
  upsert_contact: asWrite(toolUpsertContact),
  delete_contact: asWrite(toolDeleteContact),
  read_contact_thread: toolReadContactThread,
  mark_contact_thread_read: asWrite(toolMarkContactThreadRead),
  reply_to_review: asWrite(toolReplyToReview),
  mark_review_read: asWrite(toolMarkReviewRead),
  upsert_news_post: asWrite(toolUpsertNewsPost),
  upsert_event: asWrite(toolUpsertEvent),
  upsert_ingredient: asWrite(toolUpsertIngredient),
  create_purchase_order: asWrite(toolCreatePurchaseOrder),
  create_staff: asWrite(toolCreateStaff),
  delete_staff: asWrite(toolDeleteStaff),
  upsert_staff_shift: asWrite(toolUpsertStaffShift),
  delete_staff_shift: asWrite(toolDeleteStaffShift),
  list_staff_todos: toolListStaffTodos,
  upsert_staff_todo: asWrite(toolUpsertStaffTodo),
  list_documents: toolListDocuments,
  add_document_note: asWrite(toolAddDocumentNote),
  list_guides: toolListGuides,
  list_compliance: toolListCompliance,
  create_compliance_record: asWrite(toolCreateComplianceRecord),
  delete_menu_item: asWrite(toolDeleteMenuItem),
  upsert_menu_category: asWrite(toolUpsertMenuCategory),
  upsert_menu_tag: asWrite(toolUpsertMenuTag),
  upsert_menu_allergen: asWrite(async (ctx, args, locale) =>
    toolUpsertMenuTag(ctx, { ...args, kind: "allergen" }, locale),
  ),
  create_cash_book_entry: asWrite(toolCreateCashBookEntry),
  update_restaurant_stammdaten: asWrite(toolUpdateRestaurantStammdaten),
};

void WRITE_FORCE_CONFIRM_FALSE;

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

  const fn = TOOLS[name];
  if (!fn) {
    return JSON.stringify({ ok: false, error: `Unbekanntes Tool: ${name}` });
  }
  return fn(ctx, args, locale);
}
