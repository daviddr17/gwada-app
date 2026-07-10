import "server-only";

import {
  dashboardGlobalSearchResultHref,
  DASHBOARD_GLOBAL_SEARCH_CATEGORY_LABELS,
  DASHBOARD_GLOBAL_SEARCH_CATEGORY_ORDER,
} from "@/lib/dashboard/dashboard-global-search-nav";
import {
  hasModuleRead,
  type ModuleCrudPrefix,
} from "@/lib/permissions/module-crud-permissions";
import {
  ALL_RESTAURANT_PERMISSION_KEYS,
  type RestaurantPermissionKey,
} from "@/lib/permissions/restaurant-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  formatReservationSlotInRestaurantTz,
} from "@/lib/restaurant/restaurant-timezone";
import type {
  DashboardGlobalSearchCategory,
  DashboardGlobalSearchGroup,
  DashboardGlobalSearchResponse,
  DashboardGlobalSearchResultItem,
} from "@/lib/types/dashboard-global-search";
import {
  DASHBOARD_GLOBAL_SEARCH_LIMIT_PER_CATEGORY,
  DASHBOARD_GLOBAL_SEARCH_MIN_QUERY_LENGTH,
} from "@/lib/types/dashboard-global-search";
import type { SupabaseClient } from "@supabase/supabase-js";

const GALLERY_READ_KEYS: RestaurantPermissionKey[] = [
  "gallery.read",
  "gallery.create",
  "gallery.update",
  "gallery.delete",
];

function escapeIlikeTerm(term: string): string {
  return term
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '""')
    .replace(/,/g, " ")
    .trim();
}

function ilikePattern(term: string): string {
  return `%${escapeIlikeTerm(term)}%`;
}

function formatDeDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDeDateTimeLocal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatReservationSearchDateTime(
  iso: string | null | undefined,
  timeZone: string,
): string | null {
  if (!iso) return null;
  const formatted = formatReservationSlotInRestaurantTz(iso, timeZone);
  return formatted === "—" ? null : formatted;
}

async function loadRestaurantPermissionKeys(
  sb: SupabaseClient,
  restaurantId: string,
  userId: string,
): Promise<Set<string>> {
  const { data: keys, error } = await sb.rpc(
    "auth_user_restaurant_permission_keys",
    { p_restaurant_id: restaurantId },
  );

  const result = new Set<string>((keys as string[] | null) ?? []);
  if (!error && result.size > 0) {
    return expandOwnerPermissions(sb, restaurantId, userId, result);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return result;

  return expandOwnerPermissions(admin, restaurantId, userId, result);
}

async function expandOwnerPermissions(
  sb: SupabaseClient,
  restaurantId: string,
  userId: string,
  keys: Set<string>,
): Promise<Set<string>> {
  const { data: employee } = await sb
    .from("restaurant_employees")
    .select("role, restaurant_positions(slug)")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const positionSlug = (
    employee as { restaurant_positions?: { slug?: string } | null } | null
  )?.restaurant_positions?.slug;
  const employeeRole = (employee as { role?: string } | null)?.role;

  if (positionSlug === "owner" || employeeRole === "owner") {
    for (const key of ALL_RESTAURANT_PERMISSION_KEYS) {
      keys.add(key);
    }
  }

  return keys;
}

function canSearchCategory(
  has: (key: RestaurantPermissionKey) => boolean,
  category: DashboardGlobalSearchCategory,
): boolean {
  switch (category) {
    case "gallery":
      return GALLERY_READ_KEYS.some((key) => has(key));
    case "staff_todos":
      return hasModuleRead(has, "staff_todos");
    default:
      return hasModuleRead(has, category as ModuleCrudPrefix);
  }
}

function makeItem(
  category: DashboardGlobalSearchCategory,
  id: string,
  title: string,
  subtitle: string | null,
): DashboardGlobalSearchResultItem {
  return {
    id,
    category,
    title,
    subtitle,
    href: dashboardGlobalSearchResultHref(category, id),
  };
}

async function searchMenu(
  sb: SupabaseClient,
  restaurantId: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("menu_items")
    .select("id, name, price, is_active")
    .eq("restaurant_id", restaurantId)
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(limit);

  return (data ?? []).map((row) =>
    makeItem(
      "menu",
      row.id,
      row.name,
      row.is_active
        ? `${Number(row.price).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`
        : "Inaktiv",
    ),
  );
}

async function searchReservations(
  sb: SupabaseClient,
  restaurantId: string,
  query: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const filters = [
    `guest_first_name.ilike."${pattern}"`,
    `guest_last_name.ilike."${pattern}"`,
    `guest_name.ilike."${pattern}"`,
    `guest_email.ilike."${pattern}"`,
    `guest_phone.ilike."${pattern}"`,
  ];
  const numeric = query.replace(/\D/g, "");
  if (numeric.length >= 2) {
    const reservationNumber = Number.parseInt(numeric, 10);
    if (Number.isFinite(reservationNumber)) {
      filters.push(`reservation_number.eq.${reservationNumber}`);
    }
  }

  const admin = createSupabaseAdminClient();
  const timeZone = admin
    ? await fetchRestaurantTimezoneServer(admin, restaurantId)
    : DEFAULT_RESTAURANT_TIMEZONE;

  const { data } = await sb
    .from("reservations")
    .select(
      "id, guest_first_name, guest_last_name, guest_name, starts_at, party_size, reservation_number",
    )
    .eq("restaurant_id", restaurantId)
    .or(filters.join(","))
    .order("starts_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const guest =
      row.guest_name?.trim() ||
      `${row.guest_first_name} ${row.guest_last_name}`.trim();
    const date = formatReservationSearchDateTime(row.starts_at, timeZone);
    const subtitle = [date, `${row.party_size} Pers.`, `#${row.reservation_number}`]
      .filter(Boolean)
      .join(" · ");
    return makeItem("reservations", row.id, guest, subtitle);
  });
}

async function searchContacts(
  sb: SupabaseClient,
  restaurantId: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("contacts")
    .select("id, first_name, last_name, company, last_interaction_at")
    .eq("restaurant_id", restaurantId)
    .or(
      `first_name.ilike."${pattern}",last_name.ilike."${pattern}",company.ilike."${pattern}"`,
    )
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const name = `${row.first_name} ${row.last_name}`.trim();
    const subtitle =
      row.company?.trim() ||
      formatDeDate(row.last_interaction_at) ||
      null;
    return makeItem("contacts", row.id, name, subtitle);
  });
}

async function searchReviews(
  sb: SupabaseClient,
  restaurantId: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("gwada_reviews")
    .select("id, guest_display_name, comment, rating, created_at")
    .eq("restaurant_id", restaurantId)
    .or(`guest_display_name.ilike."${pattern}",comment.ilike."${pattern}"`)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const title = row.guest_display_name?.trim() || "Gast";
    const comment = row.comment?.trim();
    const subtitle = [
      `${row.rating} ★`,
      formatDeDate(row.created_at),
      comment ? comment.slice(0, 80) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return makeItem("reviews", row.id, title, subtitle);
  });
}

async function searchStaff(
  sb: SupabaseClient,
  restaurantId: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("restaurant_staff")
    .select("id, given_name, family_name, email, is_active")
    .eq("restaurant_id", restaurantId)
    .or(
      `given_name.ilike."${pattern}",family_name.ilike."${pattern}",email.ilike."${pattern}"`,
    )
    .order("given_name", { ascending: true })
    .limit(limit);

  return (data ?? []).map((row) => {
    const title = `${row.given_name} ${row.family_name}`.trim();
    const subtitle = row.is_active
      ? row.email?.trim() || null
      : "Inaktiv";
    return makeItem("staff", row.id, title, subtitle);
  });
}

async function searchInventory(
  sb: SupabaseClient,
  restaurantId: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("inventory_ingredients")
    .select("id, name, current_stock, unit, is_active")
    .eq("restaurant_id", restaurantId)
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(limit);

  return (data ?? []).map((row) =>
    makeItem(
      "inventory",
      row.id,
      row.name,
      row.is_active
        ? `${row.current_stock} ${row.unit}`
        : "Inaktiv",
    ),
  );
}

async function searchDocuments(
  sb: SupabaseClient,
  restaurantId: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("restaurant_documents")
    .select("id, title, file_name, updated_at")
    .eq("restaurant_id", restaurantId)
    .or(`title.ilike."${pattern}",file_name.ilike."${pattern}"`)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) =>
    makeItem(
      "documents",
      row.id,
      row.title?.trim() || row.file_name,
      row.file_name !== row.title ? row.file_name : formatDeDate(row.updated_at),
    ),
  );
}

async function searchNews(
  sb: SupabaseClient,
  restaurantId: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("gwada_news_posts")
    .select("id, title, status, published_at, created_at")
    .eq("restaurant_id", restaurantId)
    .ilike("title", pattern)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) =>
    makeItem(
      "news",
      row.id,
      row.title?.trim() || "Beitrag",
      [row.status, formatDeDate(row.published_at ?? row.created_at)]
        .filter(Boolean)
        .join(" · "),
    ),
  );
}

async function searchEvents(
  sb: SupabaseClient,
  restaurantId: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const admin = createSupabaseAdminClient();
  const timeZone = admin
    ? await fetchRestaurantTimezoneServer(admin, restaurantId)
    : DEFAULT_RESTAURANT_TIMEZONE;

  const { data } = await sb
    .from("gwada_events")
    .select("id, title, status, start_at")
    .eq("restaurant_id", restaurantId)
    .ilike("title", pattern)
    .order("start_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) =>
    makeItem(
      "events",
      row.id,
      row.title?.trim() || "Event",
      [row.status, formatReservationSearchDateTime(row.start_at, timeZone)]
        .filter(Boolean)
        .join(" · "),
    ),
  );
}

async function searchAccounting(
  sb: SupabaseClient,
  restaurantId: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const perTable = Math.max(3, Math.ceil(limit / 2));
  const [invoices, vouchers] = await Promise.all([
    sb
      .from("accounting_invoices")
      .select("id, voucher_number, status, recipient_snapshot, voucher_date")
      .eq("restaurant_id", restaurantId)
      .or(
        `voucher_number.ilike."${pattern}",recipient_snapshot->>name.ilike."${pattern}"`,
      )
      .order("voucher_date", { ascending: false })
      .limit(perTable),
    sb
      .from("accounting_vouchers")
      .select("id, voucher_number, status, contact_name, voucher_date")
      .eq("restaurant_id", restaurantId)
      .or(`voucher_number.ilike."${pattern}",contact_name.ilike."${pattern}"`)
      .order("voucher_date", { ascending: false })
      .limit(perTable),
  ]);

  const items: DashboardGlobalSearchResultItem[] = [];

  for (const row of invoices.data ?? []) {
    const recipient = (
      row.recipient_snapshot as { name?: string | null } | null
    )?.name?.trim();
    items.push(
      makeItem(
        "accounting",
        row.id,
        `Rechnung ${row.voucher_number}`,
        [recipient, row.status, formatDeDate(row.voucher_date)]
          .filter(Boolean)
          .join(" · "),
      ),
    );
  }

  for (const row of vouchers.data ?? []) {
    items.push(
      makeItem(
        "accounting",
        row.id,
        `Beleg ${row.voucher_number}`,
        [row.contact_name, row.status, formatDeDate(row.voucher_date)]
          .filter(Boolean)
          .join(" · "),
      ),
    );
  }

  return items.slice(0, limit);
}

async function searchGallery(
  sb: SupabaseClient,
  restaurantId: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("gwada_gallery_items")
    .select("id, title, caption, category, created_at")
    .eq("restaurant_id", restaurantId)
    .or(`title.ilike."${pattern}",caption.ilike."${pattern}"`)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) =>
    makeItem(
      "gallery",
      row.id,
      row.title?.trim() || row.caption?.trim() || "Bild",
      [row.category, formatDeDate(row.created_at)].filter(Boolean).join(" · "),
    ),
  );
}

async function searchStaffTodos(
  sb: SupabaseClient,
  restaurantId: string,
  pattern: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("restaurant_staff_todos")
    .select("id, title, priority, description")
    .eq("restaurant_id", restaurantId)
    .is("archived_at", null)
    .ilike("title", pattern)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) =>
    makeItem(
      "staff_todos",
      row.id,
      row.title?.trim() || "ToDo",
      row.description?.trim()?.slice(0, 80) || row.priority || null,
    ),
  );
}

type CategorySearcher = (
  sb: SupabaseClient,
  restaurantId: string,
  query: string,
  pattern: string,
  limit: number,
) => Promise<DashboardGlobalSearchResultItem[]>;

const CATEGORY_SEARCHERS: Record<
  DashboardGlobalSearchCategory,
  CategorySearcher
> = {
  menu: (sb, restaurantId, _query, pattern, limit) =>
    searchMenu(sb, restaurantId, pattern, limit),
  reservations: (sb, restaurantId, query, pattern, limit) =>
    searchReservations(sb, restaurantId, query, pattern, limit),
  contacts: (sb, restaurantId, _query, pattern, limit) =>
    searchContacts(sb, restaurantId, pattern, limit),
  reviews: (sb, restaurantId, _query, pattern, limit) =>
    searchReviews(sb, restaurantId, pattern, limit),
  staff: (sb, restaurantId, _query, pattern, limit) =>
    searchStaff(sb, restaurantId, pattern, limit),
  inventory: (sb, restaurantId, _query, pattern, limit) =>
    searchInventory(sb, restaurantId, pattern, limit),
  documents: (sb, restaurantId, _query, pattern, limit) =>
    searchDocuments(sb, restaurantId, pattern, limit),
  news: (sb, restaurantId, _query, pattern, limit) =>
    searchNews(sb, restaurantId, pattern, limit),
  events: (sb, restaurantId, _query, pattern, limit) =>
    searchEvents(sb, restaurantId, pattern, limit),
  accounting: (sb, restaurantId, _query, pattern, limit) =>
    searchAccounting(sb, restaurantId, pattern, limit),
  gallery: (sb, restaurantId, _query, pattern, limit) =>
    searchGallery(sb, restaurantId, pattern, limit),
  staff_todos: (sb, restaurantId, _query, pattern, limit) =>
    searchStaffTodos(sb, restaurantId, pattern, limit),
};

export async function searchDashboardGlobal(
  sb: SupabaseClient,
  restaurantId: string,
  userId: string,
  rawQuery: string,
): Promise<DashboardGlobalSearchResponse> {
  const query = rawQuery.trim();
  if (query.length < DASHBOARD_GLOBAL_SEARCH_MIN_QUERY_LENGTH) {
    return { query, groups: [] };
  }

  const permissionKeys = await loadRestaurantPermissionKeys(
    sb,
    restaurantId,
    userId,
  );
  const has = (key: RestaurantPermissionKey) => permissionKeys.has(key);

  const pattern = ilikePattern(query);
  const limit = DASHBOARD_GLOBAL_SEARCH_LIMIT_PER_CATEGORY;

  const enabledCategories = DASHBOARD_GLOBAL_SEARCH_CATEGORY_ORDER.filter(
    (category) => canSearchCategory(has, category),
  );

  const searchResults = await Promise.all(
    enabledCategories.map(async (category) => {
      const items = await CATEGORY_SEARCHERS[category](
        sb,
        restaurantId,
        query,
        pattern,
        limit,
      );
      return { category, items };
    }),
  );

  const groups: DashboardGlobalSearchGroup[] = searchResults
    .filter((entry) => entry.items.length > 0)
    .map((entry) => ({
      category: entry.category,
      label: DASHBOARD_GLOBAL_SEARCH_CATEGORY_LABELS[entry.category],
      items: entry.items,
    }));

  return { query, groups };
}
