import "server-only";

import { APP_ROUTES } from "@/lib/navigation/app-routes";
import {
  compareLine,
  formatDigestBellSubtitle,
  formatDigestDetails,
  formatEuroAmount,
  formatEuroFromCents,
  type DigestSection,
} from "@/lib/notifications/notification-digest-copy";
import {
  NOTIFICATION_MODULES,
} from "@/lib/notifications/notification-modules";
import type { NotificationItem } from "@/lib/notifications/notification-types";
import {
  addRestaurantCalendarDaysYmd,
  restaurantDayBoundsIso,
  restaurantTodayYmd,
  restaurantZonedDateKey,
} from "@/lib/restaurant/restaurant-timezone";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DIGEST_MODULE_IDS = [
  "digest_daily_preview",
  "digest_daily_review",
  "digest_weekly_preview",
  "digest_weekly_review",
] as const;

export type DigestModuleId = (typeof DIGEST_MODULE_IDS)[number];

const DAILY_PREVIEW_HOUR = 8;
const DAILY_REVIEW_HOUR = 21;
const WEEKLY_PREVIEW_HOUR = 8;
const WEEKLY_REVIEW_HOUR = 21;
const LOOKBACK_MS = 21 * 24 * 60 * 60 * 1000;

const NOTE =
  "Kosten sind voraussichtlich: Schichtplan × Stundenlohn, Bestellungen × Einkaufspreis. Kein abgeschlossenes Tagesergebnis.";

export function isDigestModule(module: string): module is DigestModuleId {
  return (DIGEST_MODULE_IDS as readonly string[]).includes(module);
}

type Snapshot = {
  revenueCents: number;
  orders: number;
  reservations: number;
  guests: number;
  noShows: number;
  shiftCount: number;
  laborCents: number;
  shiftsWithoutRate: number;
  purchaseEuros: number;
  purchaseOrders: number;
  purchaseLinesWithoutPrice: number;
  lowStockNames: string[];
  lowStockCount: number;
  reviewCount: number;
  reviewAvg: number | null;
  inboundMessages: number;
};

function emptySnapshot(): Snapshot {
  return {
    revenueCents: 0,
    orders: 0,
    reservations: 0,
    guests: 0,
    noShows: 0,
    shiftCount: 0,
    laborCents: 0,
    shiftsWithoutRate: 0,
    purchaseEuros: 0,
    purchaseOrders: 0,
    purchaseLinesWithoutPrice: 0,
    lowStockNames: [],
    lowStockCount: 0,
    reviewCount: 0,
    reviewAvg: null,
    inboundMessages: 0,
  };
}

function zonedHour(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

function zonedWeekdaySun0(date: Date, timeZone: string): number {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
}

function mondayOf(ymd: string, timeZone: string): string {
  const start = new Date(restaurantDayBoundsIso(ymd, timeZone).start);
  const weekday = zonedWeekdaySun0(start, timeZone);
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addRestaurantCalendarDaysYmd(ymd, delta, timeZone);
}

function formatYmdDe(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

function periodLabel(startYmd: string, endYmd: string): string {
  if (startYmd === endYmd) return formatYmdDe(startYmd);
  return `${formatYmdDe(startYmd)}–${formatYmdDe(endYmd)}`;
}

type ContractRow = {
  staff_id: string;
  hourly_rate_cents: number | null;
  valid_from: string;
  valid_to: string | null;
};

function hourlyCentsFor(
  contracts: ContractRow[],
  staffId: string,
  ymd: string,
): number | null {
  const match = contracts
    .filter(
      (row) =>
        row.staff_id === staffId &&
        row.valid_from <= ymd &&
        (row.valid_to == null || row.valid_to >= ymd) &&
        typeof row.hourly_rate_cents === "number" &&
        row.hourly_rate_cents > 0,
    )
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
  return match?.hourly_rate_cents ?? null;
}

async function loadSnapshot(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    startIso: string;
    endIso: string;
    startYmd: string;
    endYmd: string;
    timeZone: string;
    cancelledStatusIds: Set<string>;
    noShowStatusIds: Set<string>;
  },
): Promise<Snapshot> {
  const snap = emptySnapshot();
  const { restaurantId, startIso, endIso, startYmd, endYmd, timeZone } = params;

  const [
    ordersRes,
    reservationsRes,
    shiftsRes,
    contractsRes,
    poRes,
    ingredientsRes,
    reviewsRes,
    messagesRes,
  ] = await Promise.all([
    admin
      .from("pos_orders")
      .select("total_cents")
      .eq("restaurant_id", restaurantId)
      .eq("status", "delivered")
      .gte("closed_at", startIso)
      .lt("closed_at", endIso),
    admin
      .from("reservations")
      .select("party_size, status_id")
      .eq("restaurant_id", restaurantId)
      .gte("starts_at", startIso)
      .lt("starts_at", endIso),
    admin
      .from("restaurant_staff_scheduled_shifts")
      .select("staff_id, starts_at, ends_at, status")
      .eq("restaurant_id", restaurantId)
      .in("status", ["confirmed", "pending"])
      .lt("starts_at", endIso)
      .gt("ends_at", startIso),
    admin
      .from("restaurant_staff_contracts")
      .select("staff_id, hourly_rate_cents, valid_from, valid_to")
      .eq("restaurant_id", restaurantId),
    admin
      .from("inventory_purchase_orders")
      .select("id, status")
      .eq("restaurant_id", restaurantId)
      .gte("delivery_date", startYmd)
      .lte("delivery_date", endYmd)
      .in("status", ["open", "ordered", "closed"]),
    admin
      .from("inventory_ingredients")
      .select("id, name, purchase_unit_price, current_stock, low_stock_threshold, is_active")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true),
    admin
      .from("gwada_reviews")
      .select("rating")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    admin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("direction", "inbound")
      .gte("created_at", startIso)
      .lt("created_at", endIso),
  ]);

  const orders = ordersRes.data ?? [];
  snap.orders = orders.length;
  snap.revenueCents = orders.reduce(
    (sum, row) => sum + (Number((row as { total_cents?: number }).total_cents) || 0),
    0,
  );

  for (const row of reservationsRes.data ?? []) {
    const statusId = (row as { status_id?: string }).status_id ?? "";
    if (params.cancelledStatusIds.has(statusId)) continue;
    if (params.noShowStatusIds.has(statusId)) {
      snap.noShows += 1;
      continue;
    }
    snap.reservations += 1;
    snap.guests += Number((row as { party_size?: number }).party_size) || 0;
  }

  const contracts = (contractsRes.data ?? []) as ContractRow[];
  const rangeStart = Date.parse(startIso);
  const rangeEnd = Date.parse(endIso);
  for (const row of shiftsRes.data ?? []) {
    const shift = row as {
      staff_id: string;
      starts_at: string;
      ends_at: string;
    };
    const overlapMs = Math.max(
      0,
      Math.min(Date.parse(shift.ends_at), rangeEnd) -
        Math.max(Date.parse(shift.starts_at), rangeStart),
    );
    if (overlapMs <= 0) continue;
    snap.shiftCount += 1;
    const ymd = restaurantZonedDateKey(new Date(shift.starts_at), timeZone);
    const rate = hourlyCentsFor(contracts, shift.staff_id, ymd);
    if (rate == null) {
      snap.shiftsWithoutRate += 1;
      continue;
    }
    snap.laborCents += Math.round((overlapMs / 3_600_000) * rate);
  }

  const priceById = new Map<string, number>();
  const lowStock: { name: string; stock: number }[] = [];
  for (const row of ingredientsRes.data ?? []) {
    const ing = row as {
      id: string;
      name: string;
      purchase_unit_price: number | null;
      current_stock: number;
      low_stock_threshold: number;
    };
    if (typeof ing.purchase_unit_price === "number") {
      priceById.set(ing.id, ing.purchase_unit_price);
    }
    if (
      ing.low_stock_threshold > 0 &&
      Number(ing.current_stock) <= Number(ing.low_stock_threshold)
    ) {
      lowStock.push({ name: ing.name, stock: Number(ing.current_stock) });
    }
  }
  lowStock.sort((a, b) => a.stock - b.stock);
  snap.lowStockCount = lowStock.length;
  snap.lowStockNames = lowStock.slice(0, 6).map((row) => row.name);

  const orderIds = (poRes.data ?? []).map((row) => (row as { id: string }).id);
  snap.purchaseOrders = orderIds.length;
  if (orderIds.length > 0) {
    const { data: lines } = await admin
      .from("inventory_purchase_order_lines")
      .select("ingredient_id, quantity")
      .eq("restaurant_id", restaurantId)
      .in("order_id", orderIds);
    for (const row of lines ?? []) {
      const line = row as { ingredient_id: string; quantity: number };
      const price = priceById.get(line.ingredient_id);
      const qty = Number(line.quantity) || 0;
      if (price == null) {
        snap.purchaseLinesWithoutPrice += 1;
        continue;
      }
      snap.purchaseEuros += qty * price;
    }
  }

  const ratings = (reviewsRes.data ?? [])
    .map((row) => Number((row as { rating?: number }).rating))
    .filter((rating) => Number.isFinite(rating) && rating > 0);
  snap.reviewCount = ratings.length;
  snap.reviewAvg =
    ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : null;
  snap.inboundMessages = messagesRes.count ?? 0;

  return snap;
}

function sectionsFor(params: {
  module: DigestModuleId;
  current: Snapshot;
  previous: Snapshot | null;
}): DigestSection[] {
  const { current, previous, module } = params;
  const review = module.endsWith("_review");
  const money = (cents: number) => formatEuroFromCents(cents);
  const euros = (amount: number) => formatEuroAmount(amount);

  const revenueLine = previous
    ? compareLine(
        "Umsatz",
        money(current.revenueCents),
        current.revenueCents,
        previous.revenueCents,
        money(previous.revenueCents),
      )
    : `Umsatz: ${money(current.revenueCents)}`;
  const reservationLine = previous
    ? compareLine(
        "Reservierungen",
        String(current.reservations),
        current.reservations,
        previous.reservations,
        String(previous.reservations),
      )
    : `Reservierungen: ${current.reservations}`;

  const sales: string[] = review
    ? [
        revenueLine,
        `${current.orders} abgeschlossene Kassenbons`,
        current.orders > 0
          ? `Schnitt ${money(Math.round(current.revenueCents / current.orders))}`
          : null,
      ].filter((line): line is string => Boolean(line))
    : [
        previous
          ? `Gestern ${money(previous.revenueCents)}, ${previous.orders} Bons`
          : "Noch kein Vergleichstag",
      ];

  const guests: string[] = [
    reservationLine,
    `${current.guests} Gäste`,
    current.noShows > 0 ? `${current.noShows} nicht erschienen` : null,
  ].filter((line): line is string => Boolean(line));

  const labor = previous
    ? compareLine(
        "Personal laut Schichtplan",
        money(current.laborCents),
        current.laborCents,
        previous.laborCents,
        money(previous.laborCents),
      )
    : `Personal laut Schichtplan: ${money(current.laborCents)}`;
  const staff: string[] = [
    labor,
    `${current.shiftCount} Schichten`,
    current.shiftsWithoutRate > 0
      ? `${current.shiftsWithoutRate} ohne Stundenlohn (Festgehalt oder kein Satz)`
      : null,
  ].filter((line): line is string => Boolean(line));

  const purchase = previous
    ? compareLine(
        "Bestellungen mit Lieferdatum",
        euros(current.purchaseEuros),
        current.purchaseEuros,
        previous.purchaseEuros,
        euros(previous.purchaseEuros),
      )
    : `Bestellungen mit Lieferdatum: ${euros(current.purchaseEuros)}`;
  const orders: string[] = [
    purchase,
    `${current.purchaseOrders} Bestellungen`,
    current.purchaseLinesWithoutPrice > 0
      ? `${current.purchaseLinesWithoutPrice} Positionen ohne Einkaufspreis`
      : null,
  ].filter((line): line is string => Boolean(line));

  const stock =
    current.lowStockCount === 0
      ? ["Nichts unter der Schwelle"]
      : [
          `${current.lowStockCount} Artikel`,
          current.lowStockNames.join(", "),
        ].filter(Boolean);

  const reviews =
    current.reviewCount === 0
      ? ["Keine neuen Bewertungen"]
      : [
          `${current.reviewCount} neu`,
          current.reviewAvg != null
            ? `Schnitt ${current.reviewAvg.toFixed(1).replace(".", ",")}★`
            : null,
        ].filter((line): line is string => Boolean(line));

  const sections: DigestSection[] = [];
  if (review || previous) {
    sections.push({
      heading: review ? "Umsatz" : "Zum Vergleich",
      lines: sales,
    });
  }
  sections.push(
    { heading: "Reservierungen", lines: guests },
    { heading: "Voraussichtliche Personalkosten", lines: staff },
    { heading: "Voraussichtliche Bestellkosten", lines: orders },
    { heading: "Niedrigbestand", lines: stock },
  );

  if (review) {
    sections.push(
      { heading: "Bewertungen", lines: reviews },
      {
        heading: "Nachrichten",
        lines: [`${current.inboundMessages} eingegangen`],
      },
    );
  }

  return sections;
}

type DueDigest = {
  module: DigestModuleId;
  startYmd: string;
  endYmd: string;
  compareStartYmd: string | null;
  compareEndYmd: string | null;
};

function dueDigests(now: Date, timeZone: string): DueDigest[] {
  const hour = zonedHour(now, timeZone);
  const weekday = zonedWeekdaySun0(now, timeZone);
  const today = restaurantTodayYmd(timeZone, now);
  const due: DueDigest[] = [];

  if (hour === DAILY_PREVIEW_HOUR) {
    const yesterday = addRestaurantCalendarDaysYmd(today, -1, timeZone);
    due.push({
      module: "digest_daily_preview",
      startYmd: today,
      endYmd: today,
      compareStartYmd: yesterday,
      compareEndYmd: yesterday,
    });
  }
  if (hour === DAILY_REVIEW_HOUR) {
    const yesterday = addRestaurantCalendarDaysYmd(today, -1, timeZone);
    due.push({
      module: "digest_daily_review",
      startYmd: today,
      endYmd: today,
      compareStartYmd: yesterday,
      compareEndYmd: yesterday,
    });
  }
  if (hour === WEEKLY_PREVIEW_HOUR && weekday === 1) {
    const start = mondayOf(today, timeZone);
    due.push({
      module: "digest_weekly_preview",
      startYmd: start,
      endYmd: addRestaurantCalendarDaysYmd(start, 6, timeZone),
      compareStartYmd: null,
      compareEndYmd: null,
    });
  }
  if (hour === WEEKLY_REVIEW_HOUR && weekday === 0) {
    const start = mondayOf(today, timeZone);
    const prev = addRestaurantCalendarDaysYmd(start, -7, timeZone);
    due.push({
      module: "digest_weekly_review",
      startYmd: start,
      endYmd: addRestaurantCalendarDaysYmd(start, 6, timeZone),
      compareStartYmd: prev,
      compareEndYmd: addRestaurantCalendarDaysYmd(prev, 6, timeZone),
    });
  }
  return due;
}

async function statusIdSets(admin: SupabaseClient): Promise<{
  cancelled: Set<string>;
  noShow: Set<string>;
}> {
  const { data } = await admin.from("reservation_statuses").select("id, code");
  const cancelled = new Set<string>();
  const noShow = new Set<string>();
  for (const row of data ?? []) {
    const status = row as { id: string; code: string };
    if (status.code === "cancelled" || status.code === "declined") {
      cancelled.add(status.id);
    }
    if (status.code === "no_show") noShow.add(status.id);
  }
  return { cancelled, noShow };
}

export type DigestCronStats = {
  restaurants: number;
  emitted: number;
  skippedExisting: number;
  errors: number;
};

export async function runNotificationDigestCron(
  admin: SupabaseClient,
  now = new Date(),
): Promise<DigestCronStats> {
  const stats: DigestCronStats = {
    restaurants: 0,
    emitted: 0,
    skippedExisting: 0,
    errors: 0,
  };
  const { data: restaurants, error } = await admin
    .from("restaurants")
    .select("id");
  if (error) {
    stats.errors += 1;
    return stats;
  }

  const statuses = await statusIdSets(admin);

  for (const row of restaurants ?? []) {
    const restaurantId = (row as { id: string }).id;
    stats.restaurants += 1;
    const timeZone = await fetchRestaurantTimezoneServer(admin, restaurantId);
    const due = dueDigests(now, timeZone);
    for (const item of due) {
      const referenceId = `${item.startYmd}:${item.endYmd}`;
      const { data: existing } = await admin
        .from("notification_events")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("module", item.module)
        .eq("reference_id", referenceId)
        .maybeSingle();
      if (existing) {
        stats.skippedExisting += 1;
        continue;
      }

      const bounds = restaurantDayBoundsIso(item.startYmd, timeZone);
      const endBounds = restaurantDayBoundsIso(item.endYmd, timeZone);
      try {
        const current = await loadSnapshot(admin, {
          restaurantId,
          startIso: bounds.start,
          endIso: endBounds.end,
          startYmd: item.startYmd,
          endYmd: item.endYmd,
          timeZone,
          cancelledStatusIds: statuses.cancelled,
          noShowStatusIds: statuses.noShow,
        });
        let previous: Snapshot | null = null;
        if (item.compareStartYmd && item.compareEndYmd) {
          const prevStart = restaurantDayBoundsIso(item.compareStartYmd, timeZone);
          const prevEnd = restaurantDayBoundsIso(item.compareEndYmd, timeZone);
          previous = await loadSnapshot(admin, {
            restaurantId,
            startIso: prevStart.start,
            endIso: prevEnd.end,
            startYmd: item.compareStartYmd,
            endYmd: item.compareEndYmd,
            timeZone,
            cancelledStatusIds: statuses.cancelled,
            noShowStatusIds: statuses.noShow,
          });
        }
        const sections = sectionsFor({
          module: item.module,
          current,
          previous,
        });
        const label = periodLabel(item.startYmd, item.endYmd);
        const { error: insertError } = await admin.from("notification_events").insert({
          restaurant_id: restaurantId,
          module: item.module,
          reference_id: referenceId,
          payload: {
            periodLabel: label,
            note: NOTE,
            sections,
            href: APP_ROUTES.dashboard,
          },
        });
        if (insertError) {
          if (insertError.code === "23505") {
            stats.skippedExisting += 1;
            continue;
          }
          stats.errors += 1;
          continue;
        }
        stats.emitted += 1;
      } catch (err) {
        console.warn(
          "[digest]",
          restaurantId,
          item.module,
          err instanceof Error ? err.message : err,
        );
        stats.errors += 1;
      }
    }
  }

  return stats;
}

function parseSections(value: unknown): DigestSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as { heading?: unknown; lines?: unknown };
    const heading = typeof row.heading === "string" ? row.heading : "Zusammenfassung";
    const lines = Array.isArray(row.lines)
      ? row.lines.filter((line): line is string => typeof line === "string")
      : [];
    return [{ heading, lines }];
  });
}

export async function loadDigestNotificationItems(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module: DigestModuleId;
    limit?: number;
  },
): Promise<{ items: NotificationItem[]; totalCount: number }> {
  const limit = params.limit ?? 5;
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const { data: dismissedRows } = await sb
    .from("restaurant_digest_notification_dismissals")
    .select("event_id")
    .eq("profile_id", params.userId)
    .eq("restaurant_id", params.restaurantId);
  const dismissed = new Set(
    (dismissedRows ?? []).map((row) => (row as { event_id: string }).event_id),
  );

  const { data, error } = await sb
    .from("notification_events")
    .select("id, payload, created_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", params.module)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    console.warn("[gwada] digest bell", error.message);
    return { items: [], totalCount: 0 };
  }

  const def = NOTIFICATION_MODULES[params.module];
  const rows = (data ?? []).filter(
    (row) => !dismissed.has((row as { id: string }).id),
  );
  const items = rows.slice(0, limit).map((row) => {
    const event = row as {
      id: string;
      payload: Record<string, unknown> | null;
      created_at: string;
    };
    const payload = event.payload ?? {};
    const sections = parseSections(payload.sections);
    const label =
      typeof payload.periodLabel === "string" ? payload.periodLabel : def.label;
    return {
      id: event.id,
      title: def.label,
      subtitle: formatDigestBellSubtitle({ periodLabel: label, sections }),
      href: def.href,
      at: event.created_at,
      meta: { eventId: event.id },
    };
  });
  return { items, totalCount: rows.length };
}

export async function dismissDigestNotification(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string; eventId: string },
): Promise<{ error: string | null }> {
  const { error } = await sb.from("restaurant_digest_notification_dismissals").upsert(
    {
      profile_id: params.userId,
      restaurant_id: params.restaurantId,
      event_id: params.eventId,
    },
    { onConflict: "profile_id,restaurant_id,event_id" },
  );
  return { error: error?.message ?? null };
}

export async function dismissAllDigestNotifications(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string; module: DigestModuleId },
): Promise<{ error: string | null }> {
  const { items } = await loadDigestNotificationItems(sb, { ...params, limit: 40 });
  if (items.length === 0) return { error: null };
  const { error } = await sb.from("restaurant_digest_notification_dismissals").upsert(
    items.map((item) => ({
      profile_id: params.userId,
      restaurant_id: params.restaurantId,
      event_id: item.id,
    })),
    { onConflict: "profile_id,restaurant_id,event_id" },
  );
  return { error: error?.message ?? null };
}

export function digestPushDetails(payload: Record<string, unknown>): string {
  return formatDigestDetails({
    periodLabel:
      typeof payload.periodLabel === "string" ? payload.periodLabel : "Zeitraum",
    note: typeof payload.note === "string" ? payload.note : null,
    sections: parseSections(payload.sections),
  });
}
