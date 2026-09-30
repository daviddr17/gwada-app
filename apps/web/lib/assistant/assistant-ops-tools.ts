import "server-only";

import {
  ASSISTANT_LIST_CAP,
  assistantAsk,
  assistantAskWhich,
  resolveReadYmdRange,
} from "@/lib/assistant/assistant-ask";
import { reservationRangeIso } from "@/lib/assistant/assistant-tools";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import { resolveAssistantTarget } from "@/lib/assistant/assistant-scope";
import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import type { AppLocale } from "@/i18n/config";
import type { SupabaseClient } from "@supabase/supabase-js";

function json(value: unknown): string {
  return JSON.stringify(value);
}

async function todayYmd(sb: SupabaseClient, restaurantId: string): Promise<string> {
  const timeZone = await fetchRestaurantTimezoneServer(sb, restaurantId);
  return restaurantTodayYmd(timeZone);
}

function hmInTz(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

async function denyUnless(
  ctx: AssistantToolContext,
  restaurantId: string,
  module: "reservations" | "inventory" | "staff" | "accounting",
): Promise<string | null> {
  if (ctx.callerIsSuperadmin && ctx.zone === "superadmin") return null;
  const auth = await authorizeModuleCrud(restaurantId, module, "read");
  if (!auth.ok) return "Keine Berechtigung für diese Abfrage.";
  return null;
}

export async function toolServiceToday(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return json({ ok: false, ask: target.ask });

  const anchorId = target.kind === "one" ? target.restaurantId : ctx.restaurantId;
  const today = await todayYmd(ctx.sb, anchorId);
  const range = resolveReadYmdRange({
    today,
    dateYmd: typeof args.date_ymd === "string" ? args.date_ymd : null,
    startYmd: typeof args.start_ymd === "string" ? args.start_ymd : null,
    endYmd: typeof args.end_ymd === "string" ? args.end_ymd : null,
    locale,
  });
  if ("ask" in range) return json({ ok: false, ask: range.ask });

  if (target.kind === "one") {
    const denied = await denyUnless(ctx, target.restaurantId, "reservations");
    if (denied) return json({ ok: false, error: denied });
  }

  const bounds = await reservationRangeIso(ctx.sb, anchorId, range.start, range.end);
  if ("error" in bounds) return json({ ok: false, ask: assistantAsk(locale, "whichDate") });

  const guestName = String(args.guest_name ?? "").trim();
  const mode = String(args.mode ?? (guestName ? "one" : "count"));

  if (target.kind === "all") {
    const { data, error } = await target.sb
      .from("reservations")
      .select("party_size")
      .gte("starts_at", bounds.startIso)
      .lt("starts_at", bounds.endIso);
    if (error) return json({ ok: false, error: error.message });
    const rows = data ?? [];
    const guests = rows.reduce(
      (sum, row) => sum + (Number(row.party_size) || 0),
      0,
    );
    return json({
      ok: true,
      scope: "all",
      start_ymd: range.start,
      end_ymd: range.end,
      reservation_count: rows.length,
      guest_count: guests,
    });
  }

  if (mode === "one") {
    if (!guestName) return json({ ok: false, ask: assistantAsk(locale, "guest") });
    const q = guestName.replace(/[%_,]/g, "");
    const { data, error } = await target.sb
      .from("reservations")
      .select("guest_first_name, guest_last_name, party_size, starts_at, reservation_statuses(name)")
      .eq("restaurant_id", target.restaurantId)
      .gte("starts_at", bounds.startIso)
      .lt("starts_at", bounds.endIso)
      .or(`guest_first_name.ilike.%${q}%,guest_last_name.ilike.%${q}%`)
      .limit(6);
    if (error) return json({ ok: false, error: error.message });
    const rows = data ?? [];
    if (rows.length === 0) {
      return json({ ok: true, match: null, ask: assistantAsk(locale, "guest") });
    }
    if (rows.length > 1) {
      return json({
        ok: false,
        ask: assistantAskWhich(
          locale,
          "which",
          rows.map((row) =>
            `${row.guest_first_name ?? ""} ${row.guest_last_name ?? ""} ${hmInTz(String(row.starts_at), bounds.timeZone)}`.trim(),
          ),
        ),
      });
    }
    const row = rows[0];
    const status = Array.isArray(row.reservation_statuses)
      ? row.reservation_statuses[0]
      : row.reservation_statuses;
    return json({
      ok: true,
      match: {
        guest: `${row.guest_first_name ?? ""} ${row.guest_last_name ?? ""}`.trim(),
        time: hmInTz(String(row.starts_at), bounds.timeZone),
        party_size: row.party_size,
        status: status && typeof status === "object" && "name" in status ? status.name : null,
      },
    });
  }

  const { data: sizeRows, error: countError } = await target.sb
    .from("reservations")
    .select("party_size")
    .eq("restaurant_id", target.restaurantId)
    .gte("starts_at", bounds.startIso)
    .lt("starts_at", bounds.endIso);
  if (countError) return json({ ok: false, error: countError.message });
  const count = sizeRows?.length ?? 0;
  const guestCount = (sizeRows ?? []).reduce(
    (sum, row) => sum + (Number(row.party_size) || 0),
    0,
  );

  if (mode !== "list") {
    return json({
      ok: true,
      scope: "one",
      restaurant_name: target.restaurantName,
      start_ymd: range.start,
      end_ymd: range.end,
      reservation_count: count,
      guest_count: guestCount,
    });
  }

  const { data, error } = await target.sb
    .from("reservations")
    .select("guest_first_name, guest_last_name, party_size, starts_at, reservation_statuses(name)")
    .eq("restaurant_id", target.restaurantId)
    .gte("starts_at", bounds.startIso)
    .lt("starts_at", bounds.endIso)
    .order("starts_at", { ascending: true })
    .limit(ASSISTANT_LIST_CAP);
  if (error) return json({ ok: false, error: error.message });
  return json({
    ok: true,
    scope: "one",
    restaurant_name: target.restaurantName,
    start_ymd: range.start,
    end_ymd: range.end,
    reservation_count: count ?? 0,
    list_capped: (count ?? 0) > ASSISTANT_LIST_CAP,
    rows: (data ?? []).map((row) => {
      const status = Array.isArray(row.reservation_statuses)
        ? row.reservation_statuses[0]
        : row.reservation_statuses;
      return {
        guest: `${row.guest_first_name ?? ""} ${row.guest_last_name ?? ""}`.trim(),
        time: hmInTz(String(row.starts_at), bounds.timeZone),
        party_size: row.party_size,
        status: status && typeof status === "object" && "name" in status ? status.name : null,
      };
    }),
  });
}

export async function toolStock(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return json({ ok: false, ask: target.ask });
  const name = String(args.name ?? args.ingredient_name ?? "").trim();
  const mode = String(args.mode ?? (name ? "one" : "count"));

  if (target.kind === "all") {
    const { count, error } = await target.sb
      .from("inventory_ingredients")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .lte("current_stock", 0);
    if (error) return json({ ok: false, error: error.message });
    return json({ ok: true, scope: "all", empty_count: count ?? 0 });
  }

  const denied = await denyUnless(ctx, target.restaurantId, "inventory");
  if (denied) return json({ ok: false, error: denied });

  if (mode === "one") {
    if (!name) return json({ ok: false, ask: assistantAsk(locale, "dish") });
    const q = name.replace(/[%_,]/g, "");
    const { data, error } = await target.sb
      .from("inventory_ingredients")
      .select("name, current_stock, unit")
      .eq("restaurant_id", target.restaurantId)
      .eq("is_active", true)
      .ilike("name", `%${q}%`)
      .order("name")
      .limit(6);
    if (error) return json({ ok: false, error: error.message });
    const rows = data ?? [];
    if (rows.length === 0) return json({ ok: false, ask: assistantAsk(locale, "dish") });
    if (rows.length > 1) {
      return json({
        ok: false,
        ask: assistantAskWhich(locale, "which", rows.map((row) => String(row.name))),
      });
    }
    return json({ ok: true, match: rows[0] });
  }

  const [{ count: emptyCount, error: emptyError }, { count: openOrders, error: orderError }] =
    await Promise.all([
      target.sb
        .from("inventory_ingredients")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", target.restaurantId)
        .eq("is_active", true)
        .lte("current_stock", 0),
      target.sb
        .from("inventory_purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", target.restaurantId)
        .in("status", ["open", "ordered"]),
    ]);
  if (emptyError) return json({ ok: false, error: emptyError.message });
  if (orderError) return json({ ok: false, error: orderError.message });

  if (mode !== "list") {
    return json({
      ok: true,
      restaurant_name: target.restaurantName,
      empty_count: emptyCount ?? 0,
      open_orders: openOrders ?? 0,
    });
  }

  const { data, error } = await target.sb
    .from("inventory_ingredients")
    .select("name, current_stock, unit")
    .eq("restaurant_id", target.restaurantId)
    .eq("is_active", true)
    .lte("current_stock", 0)
    .order("name")
    .limit(ASSISTANT_LIST_CAP);
  if (error) return json({ ok: false, error: error.message });
  return json({
    ok: true,
    restaurant_name: target.restaurantName,
    empty_count: emptyCount ?? 0,
    open_orders: openOrders ?? 0,
    list_capped: (emptyCount ?? 0) > ASSISTANT_LIST_CAP,
    rows: data ?? [],
  });
}

export async function toolStaffOnShift(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return json({ ok: false, ask: target.ask });
  const name = String(args.name ?? "").trim();
  const mode = String(args.mode ?? (name ? "one" : "count"));

  if (target.kind === "all") {
    const { count, error } = await target.sb
      .from("restaurant_staff_work_entries")
      .select("id", { count: "exact", head: true })
      .eq("is_open", true);
    if (error) return json({ ok: false, error: error.message });
    return json({ ok: true, scope: "all", on_shift_count: count ?? 0 });
  }

  const denied = await denyUnless(ctx, target.restaurantId, "staff");
  if (denied) return json({ ok: false, error: denied });

  if (mode === "one") {
    if (!name) return json({ ok: false, ask: assistantAsk(locale, "guest") });
    const q = name.replace(/[%_,]/g, "");
    const { data: people, error } = await target.sb
      .from("restaurant_staff")
      .select("id, given_name, family_name")
      .eq("restaurant_id", target.restaurantId)
      .eq("is_active", true)
      .or(`given_name.ilike.%${q}%,family_name.ilike.%${q}%`)
      .limit(6);
    if (error) return json({ ok: false, error: error.message });
    const rows = people ?? [];
    if (rows.length === 0) return json({ ok: false, ask: assistantAsk(locale, "guest") });
    if (rows.length > 1) {
      return json({
        ok: false,
        ask: assistantAskWhich(
          locale,
          "which",
          rows.map((row) => `${row.given_name ?? ""} ${row.family_name ?? ""}`.trim()),
        ),
      });
    }
    const person = rows[0];
    const { data: open } = await target.sb
      .from("restaurant_staff_work_entries")
      .select("entry_type, starts_at")
      .eq("restaurant_id", target.restaurantId)
      .eq("staff_id", person.id)
      .eq("is_open", true)
      .limit(1);
    const entry = open?.[0];
    return json({
      ok: true,
      match: {
        name: `${person.given_name ?? ""} ${person.family_name ?? ""}`.trim(),
        on_shift: Boolean(entry),
        status: entry?.entry_type === "break" ? "pause" : entry ? "da" : "nicht da",
      },
    });
  }

  const { count, error: countError } = await target.sb
    .from("restaurant_staff_work_entries")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", target.restaurantId)
    .eq("is_open", true);
  if (countError) return json({ ok: false, error: countError.message });

  if (mode !== "list") {
    return json({
      ok: true,
      restaurant_name: target.restaurantName,
      on_shift_count: count ?? 0,
    });
  }

  const { data, error } = await target.sb
    .from("restaurant_staff_work_entries")
    .select("entry_type, starts_at, restaurant_staff(given_name, family_name)")
    .eq("restaurant_id", target.restaurantId)
    .eq("is_open", true)
    .order("starts_at", { ascending: true })
    .limit(ASSISTANT_LIST_CAP);
  if (error) return json({ ok: false, error: error.message });
  return json({
    ok: true,
    restaurant_name: target.restaurantName,
    on_shift_count: count ?? 0,
    list_capped: (count ?? 0) > ASSISTANT_LIST_CAP,
    rows: (data ?? []).map((row) => {
      const staff = Array.isArray(row.restaurant_staff)
        ? row.restaurant_staff[0]
        : row.restaurant_staff;
      const label =
        staff && typeof staff === "object"
          ? `${"given_name" in staff ? staff.given_name : ""} ${"family_name" in staff ? staff.family_name : ""}`.trim()
          : "";
      return {
        name: label,
        status: row.entry_type === "break" ? "pause" : "da",
      };
    }),
  });
}

function grossFromTotals(totals: unknown): number {
  if (!totals || typeof totals !== "object") return 0;
  const value = (totals as { totalGross?: unknown }).totalGross;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function toolOpenAmounts(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return json({ ok: false, ask: target.ask });
  const name = String(args.name ?? args.voucher_number ?? "").trim();
  const mode = String(args.mode ?? (name ? "one" : "count"));

  if (target.kind === "all") {
    const { data, error } = await target.sb
      .from("accounting_invoices")
      .select("totals")
      .in("status", ["open", "overdue"]);
    if (error) return json({ ok: false, error: error.message });
    const rows = data ?? [];
    const openGross = rows.reduce((sum, row) => sum + grossFromTotals(row.totals), 0);
    return json({
      ok: true,
      scope: "all",
      open_count: rows.length,
      open_gross: Math.round(openGross * 100) / 100,
      currency: "EUR",
    });
  }

  const denied = await denyUnless(ctx, target.restaurantId, "accounting");
  if (denied) return json({ ok: false, error: denied });

  if (mode === "one") {
    if (!name) return json({ ok: false, ask: assistantAsk(locale, "amount") });
    const q = name.replace(/[%_,]/g, "");
    const { data, error } = await target.sb
      .from("accounting_invoices")
      .select("voucher_number, status, currency, totals, title")
      .eq("restaurant_id", target.restaurantId)
      .in("status", ["open", "overdue"])
      .or(`voucher_number.ilike.%${q}%,title.ilike.%${q}%`)
      .limit(6);
    if (error) return json({ ok: false, error: error.message });
    const rows = data ?? [];
    if (rows.length === 0) return json({ ok: false, ask: assistantAsk(locale, "amount") });
    if (rows.length > 1) {
      return json({
        ok: false,
        ask: assistantAskWhich(
          locale,
          "which",
          rows.map((row) => String(row.voucher_number ?? row.title ?? "")),
        ),
      });
    }
    const row = rows[0];
    return json({
      ok: true,
      match: {
        voucher_number: row.voucher_number,
        title: row.title,
        status: row.status,
        currency: row.currency,
        open_gross: grossFromTotals(row.totals),
      },
    });
  }

  const { data, error } = await target.sb
    .from("accounting_invoices")
    .select("voucher_number, status, currency, totals, title")
    .eq("restaurant_id", target.restaurantId)
    .in("status", ["open", "overdue"]);
  if (error) return json({ ok: false, error: error.message });
  const rows = data ?? [];
  const openGross = rows.reduce((sum, row) => sum + grossFromTotals(row.totals), 0);
  const listed = [...rows]
    .sort((a, b) => grossFromTotals(b.totals) - grossFromTotals(a.totals))
    .slice(0, ASSISTANT_LIST_CAP)
    .map((row) => ({
      voucher_number: row.voucher_number,
      title: row.title,
      status: row.status,
      open_gross: grossFromTotals(row.totals),
      currency: row.currency,
    }));

  return json({
    ok: true,
    restaurant_name: target.restaurantName,
    open_count: rows.length,
    open_gross: Math.round(openGross * 100) / 100,
    currency: rows[0]?.currency ?? "EUR",
    ...(mode === "list"
      ? { list_capped: rows.length > ASSISTANT_LIST_CAP, rows: listed }
      : {}),
  });
}
