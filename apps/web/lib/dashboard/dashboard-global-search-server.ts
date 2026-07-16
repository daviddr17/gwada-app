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
  formatRestaurantDateTime,
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
import {
  fuzzyTextMatchesQuery,
  queryAllowsFuzzy,
  textIncludesQueryExact,
} from "@/lib/utils/fuzzy-search";
import type { SupabaseClient } from "@supabase/supabase-js";

const GALLERY_READ_KEYS: RestaurantPermissionKey[] = [
  "gallery.read",
  "gallery.create",
  "gallery.update",
  "gallery.delete",
];

/** Kandidaten vor Fuzzy — klein halten für stabile Latenz. */
const FUZZY_CANDIDATE_LIMIT = 48;
/** Exakte Kurzsuche: knapp über Ergebnis-Limit. */
const EXACT_CANDIDATE_LIMIT = 24;
/** Mitarbeiter-Vollscan nur bei Fuzzy, hart gedeckelt. */
const STAFF_FUZZY_FETCH_LIMIT = 300;

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

/** Wörter der Sucheingabe — „Max Mustermann“ → ["Max", "Mustermann"]. */
function splitSearchTokens(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function tokenOrClause(fields: readonly string[], token: string): string {
  const pattern = ilikePattern(token);
  return fields.map((field) => `${field}.ilike."${pattern}"`).join(",");
}

/**
 * Enger Filter: jedes Wort muss in mind. einem Feld vorkommen (kein Fuzzy).
 */
function strictTokenFieldsFilter(
  fields: readonly string[],
  query: string,
): string {
  const tokens = splitSearchTokens(query);
  const effective = tokens.length > 0 ? tokens : [query.trim()].filter(Boolean);
  if (effective.length === 0) return "";
  if (effective.length === 1) {
    return tokenOrClause(fields, effective[0]!);
  }
  const andParts = effective.map(
    (token) => `or(${tokenOrClause(fields, token)})`,
  );
  return `and(${andParts.join(",")})`;
}

/** Wenige DB-Varianten pro Token — genug für Tippfehler, wenig Scan-Breite. */
function typoTolerantTerms(token: string): string[] {
  const t = token.trim();
  if (t.length < 2) return t ? [t] : [];
  const terms = new Set<string>([t]);
  if (t.length >= 4) {
    terms.add(t.slice(0, -1));
  }
  if (t.length >= 6) {
    terms.add(t.slice(0, Math.max(4, t.length - 2)));
  }
  return [...terms];
}

/**
 * Breite OR-Filter für Fuzzy-Kandidaten (nur wenn Fuzzy aktiv).
 */
function broadFieldsOrFilter(
  fields: readonly string[],
  query: string,
): string {
  const tokens = splitSearchTokens(query);
  const terms = new Set<string>();
  for (const token of tokens.length > 0 ? tokens : [query.trim()]) {
    for (const term of typoTolerantTerms(token)) {
      terms.add(term);
    }
  }
  const clauses: string[] = [];
  for (const term of terms) {
    const pattern = ilikePattern(term);
    for (const field of fields) {
      clauses.push(`${field}.ilike."${pattern}"`);
    }
  }
  return clauses.join(",");
}

function fieldsFilterForQuery(
  fields: readonly string[],
  query: string,
): string {
  return queryAllowsFuzzy(query)
    ? broadFieldsOrFilter(fields, query)
    : strictTokenFieldsFilter(fields, query);
}

function candidateLimitForQuery(query: string): number {
  return queryAllowsFuzzy(query) ? FUZZY_CANDIDATE_LIMIT : EXACT_CANDIDATE_LIMIT;
}

function pickFuzzyMatches<T>(
  rows: T[],
  query: string,
  haystack: (row: T) => string,
  limit: number,
): T[] {
  const exact: T[] = [];
  const fuzzy: T[] = [];
  const allowFuzzy = queryAllowsFuzzy(query);
  for (const row of rows) {
    const text = haystack(row);
    if (textIncludesQueryExact(text, query)) {
      exact.push(row);
    } else if (allowFuzzy && fuzzyTextMatchesQuery(text, query)) {
      fuzzy.push(row);
    }
    if (exact.length >= limit) break;
  }
  if (exact.length >= limit) return exact.slice(0, limit);
  return [...exact, ...fuzzy].slice(0, limit);
}

function formatDeDate(
  iso: string | null | undefined,
  timeZone: string,
): string | null {
  if (!iso) return null;
  const formatted = formatRestaurantDateTime(iso, timeZone, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatted === "—" ? null : formatted;
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
  query: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const filter = fieldsFilterForQuery(["name"], query);
  const { data } = await sb
    .from("menu_items")
    .select("id, name, price, is_active")
    .eq("restaurant_id", restaurantId)
    .or(filter)
    .order("name", { ascending: true })
    .limit(candidateLimitForQuery(query));

  const matched = pickFuzzyMatches(
    data ?? [],
    query,
    (row) => row.name,
    limit,
  );

  return matched.map((row) =>
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
  _pattern: string,
  limit: number,
  timeZone: string,
): Promise<DashboardGlobalSearchResultItem[]> {
  const nameFields = [
    "guest_first_name",
    "guest_last_name",
    "guest_name",
    "guest_email",
    "guest_phone",
  ] as const;
  const tokens = splitSearchTokens(query);
  const nameFilter = fieldsFilterForQuery(nameFields, query);
  const numeric = query.replace(/\D/g, "");
  const reservationNumber =
    numeric.length >= 2 && tokens.length === 1
      ? Number.parseInt(numeric, 10)
      : NaN;
  const filters =
    Number.isFinite(reservationNumber) && nameFilter
      ? `${nameFilter},reservation_number.eq.${reservationNumber}`
      : Number.isFinite(reservationNumber)
        ? `reservation_number.eq.${reservationNumber}`
        : nameFilter;

  const { data } = await sb
    .from("reservations")
    .select(
      "id, guest_first_name, guest_last_name, guest_name, guest_email, guest_phone, starts_at, party_size, reservation_number",
    )
    .eq("restaurant_id", restaurantId)
    .or(filters)
    .order("starts_at", { ascending: false })
    .limit(candidateLimitForQuery(query));

  const matched = pickFuzzyMatches(
    data ?? [],
    query,
    (row) => {
      const guest =
        row.guest_name?.trim() ||
        `${row.guest_first_name} ${row.guest_last_name}`.trim();
      return [
        guest,
        row.guest_email,
        row.guest_phone,
        String(row.reservation_number ?? ""),
      ]
        .filter(Boolean)
        .join(" ");
    },
    limit,
  );

  return matched.map((row) => {
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
  query: string,
  limit: number,
  timeZone: string,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("contacts")
    .select("id, first_name, last_name, company, last_interaction_at")
    .eq("restaurant_id", restaurantId)
    .or(fieldsFilterForQuery(["first_name", "last_name", "company"], query))
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .limit(candidateLimitForQuery(query));

  const matched = pickFuzzyMatches(
    data ?? [],
    query,
    (row) =>
      [`${row.first_name} ${row.last_name}`.trim(), row.company]
        .filter(Boolean)
        .join(" "),
    limit,
  );

  return matched.map((row) => {
    const name = `${row.first_name} ${row.last_name}`.trim();
    const subtitle =
      row.company?.trim() ||
      formatDeDate(row.last_interaction_at, timeZone) ||
      null;
    return makeItem("contacts", row.id, name, subtitle);
  });
}

async function searchReviews(
  sb: SupabaseClient,
  restaurantId: string,
  query: string,
  limit: number,
  timeZone: string,
): Promise<DashboardGlobalSearchResultItem[]> {
  // Nur Gastname — lange Kommentare wären teuer und unruhig in der Globalsuche.
  const { data } = await sb
    .from("gwada_reviews")
    .select("id, guest_display_name, comment, rating, created_at")
    .eq("restaurant_id", restaurantId)
    .or(fieldsFilterForQuery(["guest_display_name"], query))
    .order("created_at", { ascending: false })
    .limit(candidateLimitForQuery(query));

  const matched = pickFuzzyMatches(
    data ?? [],
    query,
    (row) => row.guest_display_name?.trim() || "",
    limit,
  );

  return matched.map((row) => {
    const title = row.guest_display_name?.trim() || "Gast";
    const comment = row.comment?.trim();
    const subtitle = [
      `${row.rating} ★`,
      formatDeDate(row.created_at, timeZone),
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
  query: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const staffFields = ["given_name", "family_name", "email"] as const;
  let request = sb
    .from("restaurant_staff")
    .select("id, given_name, family_name, email, is_active")
    .eq("restaurant_id", restaurantId)
    .order("given_name", { ascending: true });

  // Fuzzy: begrenzter Vollscan (Tippfehler am Wortanfang). Kurzquery: enger Filter.
  if (queryAllowsFuzzy(query)) {
    request = request.limit(STAFF_FUZZY_FETCH_LIMIT);
  } else {
    request = request
      .or(strictTokenFieldsFilter(staffFields, query))
      .limit(EXACT_CANDIDATE_LIMIT);
  }

  const { data } = await request;

  const matched = pickFuzzyMatches(
    data ?? [],
    query,
    (row) =>
      [`${row.given_name} ${row.family_name}`.trim(), row.email]
        .filter(Boolean)
        .join(" "),
    limit,
  );

  return matched.map((row) => {
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
  query: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("inventory_ingredients")
    .select("id, name, current_stock, unit, is_active")
    .eq("restaurant_id", restaurantId)
    .or(fieldsFilterForQuery(["name"], query))
    .order("name", { ascending: true })
    .limit(candidateLimitForQuery(query));

  const matched = pickFuzzyMatches(
    data ?? [],
    query,
    (row) => row.name,
    limit,
  );

  return matched.map((row) =>
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
  query: string,
  limit: number,
  timeZone: string,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("restaurant_documents")
    .select("id, title, file_name, updated_at")
    .eq("restaurant_id", restaurantId)
    .or(fieldsFilterForQuery(["title", "file_name"], query))
    .order("updated_at", { ascending: false })
    .limit(candidateLimitForQuery(query));

  const matched = pickFuzzyMatches(
    data ?? [],
    query,
    (row) => [row.title, row.file_name].filter(Boolean).join(" "),
    limit,
  );

  return matched.map((row) =>
    makeItem(
      "documents",
      row.id,
      row.title?.trim() || row.file_name,
      row.file_name !== row.title ? row.file_name : formatDeDate(row.updated_at, timeZone),
    ),
  );
}

async function searchNews(
  sb: SupabaseClient,
  restaurantId: string,
  query: string,
  limit: number,
  timeZone: string,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("gwada_news_posts")
    .select("id, title, status, published_at, created_at")
    .eq("restaurant_id", restaurantId)
    .or(fieldsFilterForQuery(["title"], query))
    .order("created_at", { ascending: false })
    .limit(candidateLimitForQuery(query));

  const matched = pickFuzzyMatches(
    data ?? [],
    query,
    (row) => row.title ?? "",
    limit,
  );

  return matched.map((row) =>
    makeItem(
      "news",
      row.id,
      row.title?.trim() || "Beitrag",
      [row.status, formatDeDate(row.published_at ?? row.created_at, timeZone)]
        .filter(Boolean)
        .join(" · "),
    ),
  );
}

async function searchEvents(
  sb: SupabaseClient,
  restaurantId: string,
  query: string,
  limit: number,
  timeZone: string,
): Promise<DashboardGlobalSearchResultItem[]> {
  const { data } = await sb
    .from("gwada_events")
    .select("id, title, status, start_at")
    .eq("restaurant_id", restaurantId)
    .or(fieldsFilterForQuery(["title"], query))
    .order("start_at", { ascending: false })
    .limit(candidateLimitForQuery(query));

  const matched = pickFuzzyMatches(
    data ?? [],
    query,
    (row) => row.title ?? "",
    limit,
  );

  return matched.map((row) =>
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
  query: string,
  limit: number,
  timeZone: string,
): Promise<DashboardGlobalSearchResultItem[]> {
  const perTable = Math.ceil(candidateLimitForQuery(query) / 2);
  const invoiceFilter = fieldsFilterForQuery(
    ["voucher_number", "recipient_snapshot->>name"],
    query,
  );
  const voucherFilter = fieldsFilterForQuery(
    ["voucher_number", "contact_name"],
    query,
  );
  const [invoices, vouchers] = await Promise.all([
    sb
      .from("accounting_invoices")
      .select("id, voucher_number, status, recipient_snapshot, voucher_date")
      .eq("restaurant_id", restaurantId)
      .or(invoiceFilter)
      .order("voucher_date", { ascending: false })
      .limit(perTable),
    sb
      .from("accounting_vouchers")
      .select("id, voucher_number, status, contact_name, voucher_date")
      .eq("restaurant_id", restaurantId)
      .or(voucherFilter)
      .order("voucher_date", { ascending: false })
      .limit(perTable),
  ]);

  type AccRow = {
    kind: "invoice" | "voucher";
    id: string;
    voucher_number: string;
    status: string;
    voucher_date: string | null;
    recipient?: string | null;
    contact_name?: string | null;
  };

  const rows: AccRow[] = [
    ...(invoices.data ?? []).map((row) => ({
      kind: "invoice" as const,
      id: row.id as string,
      voucher_number: row.voucher_number as string,
      status: row.status as string,
      voucher_date: row.voucher_date as string | null,
      recipient: (
        row.recipient_snapshot as { name?: string | null } | null
      )?.name?.trim(),
    })),
    ...(vouchers.data ?? []).map((row) => ({
      kind: "voucher" as const,
      id: row.id as string,
      voucher_number: row.voucher_number as string,
      status: row.status as string,
      voucher_date: row.voucher_date as string | null,
      contact_name: row.contact_name as string | null,
    })),
  ];

  const matched = pickFuzzyMatches(
    rows,
    query,
    (row) =>
      [
        row.voucher_number,
        row.kind === "invoice" ? row.recipient : row.contact_name,
      ]
        .filter(Boolean)
        .join(" "),
    limit,
  );

  return matched.map((row) =>
    makeItem(
      "accounting",
      row.id,
      row.kind === "invoice"
        ? `Rechnung ${row.voucher_number}`
        : `Beleg ${row.voucher_number}`,
      [
        row.kind === "invoice" ? row.recipient : row.contact_name,
        row.status,
        formatDeDate(row.voucher_date, timeZone),
      ]
        .filter(Boolean)
        .join(" · "),
    ),
  );
}

async function searchGallery(
  sb: SupabaseClient,
  restaurantId: string,
  query: string,
  limit: number,
  timeZone: string,
): Promise<DashboardGlobalSearchResultItem[]> {
  // Titel reicht für Globalsuche — Captions können lang sein.
  const { data } = await sb
    .from("gwada_gallery_items")
    .select("id, title, caption, category, created_at")
    .eq("restaurant_id", restaurantId)
    .or(fieldsFilterForQuery(["title"], query))
    .order("created_at", { ascending: false })
    .limit(candidateLimitForQuery(query));

  const matched = pickFuzzyMatches(
    data ?? [],
    query,
    (row) => row.title?.trim() || "",
    limit,
  );

  return matched.map((row) =>
    makeItem(
      "gallery",
      row.id,
      row.title?.trim() || row.caption?.trim() || "Bild",
      [row.category, formatDeDate(row.created_at, timeZone)].filter(Boolean).join(" · "),
    ),
  );
}

async function searchStaffTodos(
  sb: SupabaseClient,
  restaurantId: string,
  query: string,
  limit: number,
): Promise<DashboardGlobalSearchResultItem[]> {
  // Nur Titel — Beschreibungen nicht in den Fuzzy-Hot-Path.
  const { data } = await sb
    .from("restaurant_staff_todos")
    .select("id, title, priority, description")
    .eq("restaurant_id", restaurantId)
    .is("archived_at", null)
    .or(fieldsFilterForQuery(["title"], query))
    .order("updated_at", { ascending: false })
    .limit(candidateLimitForQuery(query));

  const matched = pickFuzzyMatches(
    data ?? [],
    query,
    (row) => row.title?.trim() || "",
    limit,
  );

  return matched.map((row) =>
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
  timeZone: string,
) => Promise<DashboardGlobalSearchResultItem[]>;

const CATEGORY_SEARCHERS: Record<
  DashboardGlobalSearchCategory,
  CategorySearcher
> = {
  menu: (sb, restaurantId, query, _pattern, limit, _timeZone) =>
    searchMenu(sb, restaurantId, query, limit),
  reservations: (sb, restaurantId, query, pattern, limit, timeZone) =>
    searchReservations(sb, restaurantId, query, pattern, limit, timeZone),
  contacts: (sb, restaurantId, query, _pattern, limit, timeZone) =>
    searchContacts(sb, restaurantId, query, limit, timeZone),
  reviews: (sb, restaurantId, query, _pattern, limit, timeZone) =>
    searchReviews(sb, restaurantId, query, limit, timeZone),
  staff: (sb, restaurantId, query, _pattern, limit, _timeZone) =>
    searchStaff(sb, restaurantId, query, limit),
  inventory: (sb, restaurantId, query, _pattern, limit, _timeZone) =>
    searchInventory(sb, restaurantId, query, limit),
  documents: (sb, restaurantId, query, _pattern, limit, timeZone) =>
    searchDocuments(sb, restaurantId, query, limit, timeZone),
  news: (sb, restaurantId, query, _pattern, limit, timeZone) =>
    searchNews(sb, restaurantId, query, limit, timeZone),
  events: (sb, restaurantId, query, _pattern, limit, timeZone) =>
    searchEvents(sb, restaurantId, query, limit, timeZone),
  accounting: (sb, restaurantId, query, _pattern, limit, timeZone) =>
    searchAccounting(sb, restaurantId, query, limit, timeZone),
  gallery: (sb, restaurantId, query, _pattern, limit, timeZone) =>
    searchGallery(sb, restaurantId, query, limit, timeZone),
  staff_todos: (sb, restaurantId, query, _pattern, limit, _timeZone) =>
    searchStaffTodos(sb, restaurantId, query, limit),
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
  const admin = createSupabaseAdminClient();
  const timeZone = admin
    ? await fetchRestaurantTimezoneServer(admin, restaurantId)
    : DEFAULT_RESTAURANT_TIMEZONE;

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
        timeZone,
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
