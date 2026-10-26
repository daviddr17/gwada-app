import type OpenAI from "openai";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";

/**
 * Permission any-of list for exposing a tool to the LLM.
 * `null` = always available (handbook).
 */
export const ASSISTANT_TOOL_ANY_OF_PERMISSIONS: Record<
  string,
  RestaurantPermissionKey[] | null
> = {
  search_handbook: null,
  count_reservations: ["reservations.read"],
  service_today: ["reservations.read"],
  create_reservation: ["reservations.create"],
  update_reservation: ["reservations.update"],
  delete_reservation: ["reservations.delete"],
  set_reservation_day_note: ["reservations.read", "reservations.manage"],
  resolve_reservation_change_request: ["reservations.update"],
  get_restaurant_rules: ["reservations.read", "settings.opening_hours"],
  update_opening_hours: ["settings.opening_hours"],
  sync_platforms: ["settings.opening_hours", "reviews.read"],
  search_menu: ["menu.read"],
  set_menu_item_active: ["menu.update"],
  upsert_menu_item: ["menu.create", "menu.update"],
  delete_menu_item: ["menu.delete"],
  upsert_menu_category: ["menu.create", "menu.update"],
  upsert_menu_tag: ["menu.create", "menu.update"],
  upsert_menu_allergen: ["menu.create", "menu.update"],
  stock: ["inventory.read"],
  adjust_ingredient_stock: ["inventory.update"],
  upsert_ingredient: ["inventory.create", "inventory.update"],
  purchase_orders: ["inventory.read"],
  set_purchase_order_status: ["inventory.update"],
  create_purchase_order: ["inventory.create", "inventory.update"],
  staff_on_shift: ["staff.read"],
  staff_shifts: ["staff.read"],
  create_staff: ["staff.create"],
  update_staff: ["staff.update"],
  delete_staff: ["staff.delete"],
  upsert_staff_shift: ["staff.create", "staff.update"],
  delete_staff_shift: ["staff.delete", "staff.update"],
  search_contacts: ["contacts.read"],
  inbox_summary: ["contacts.read"],
  upsert_contact: ["contacts.create", "contacts.update"],
  delete_contact: ["contacts.delete"],
  read_contact_thread: ["contacts.read"],
  mark_contact_thread_read: ["contacts.read"],
  send_contact_message: ["contacts.read"],
  reviews_summary: ["reviews.read"],
  reply_to_review: ["reviews.update"],
  mark_review_read: ["reviews.read"],
  content_feed: ["news.read", "events.read"],
  upsert_news_post: ["news.create", "news.update"],
  publish_news_post: ["news.create", "news.update"],
  upsert_event: ["events.create", "events.update"],
  publish_event: ["events.create", "events.update"],
  open_amounts: ["accounting.read"],
  create_cash_book_entry: ["accounting.create"],
  restaurant_stats: ["insights.read"],
  list_staff_todos: ["staff_todos.read"],
  upsert_staff_todo: ["staff_todos.create", "staff_todos.update"],
  complete_staff_todo: ["staff_todos.update"],
  list_documents: ["documents.read"],
  add_document_note: [
    "documents.notes.edit",
    "documents.update",
    "documents.create",
  ],
  list_guides: ["guides.read"],
  list_compliance: ["compliance.read"],
  create_compliance_record: ["compliance.create"],
  update_restaurant_stammdaten: ["settings.restaurant"],
};

export function filterAssistantToolDefinitions(
  tools: OpenAI.Chat.Completions.ChatCompletionTool[],
  allowedKeys: Set<string> | null,
  options?: { skipFilter?: boolean },
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  if (options?.skipFilter || !allowedKeys) return tools;
  return tools.filter((tool) => {
    if (tool.type !== "function") return true;
    const name = tool.function.name;
    const req = ASSISTANT_TOOL_ANY_OF_PERMISSIONS[name];
    if (req === null || req === undefined) return true;
    if (req.length === 0) return true;
    return req.some((k) => allowedKeys.has(k));
  });
}
