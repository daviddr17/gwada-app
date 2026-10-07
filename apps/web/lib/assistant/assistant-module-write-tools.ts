import "server-only";

import { assistantAsk, assistantAskWhich } from "@/lib/assistant/assistant-ask";
import { resolveAssistantTarget } from "@/lib/assistant/assistant-scope";
import {
  assistantJson,
  denyUnlessModuleCrud,
  draftMutation,
} from "@/lib/assistant/assistant-tool-auth";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import { reservationRangeIso } from "@/lib/assistant/assistant-tools";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import type { AppLocale } from "@/i18n/config";

async function findReservationByGuest(
  ctx: AssistantToolContext,
  restaurantId: string,
  guestName: string,
  dateYmd: string | null,
  locale: AppLocale,
): Promise<
  | { ok: true; id: string; label: string; status_id: string | null }
  | { ok: false; ask?: string; error?: string }
> {
  const today = restaurantTodayYmd(
    await fetchRestaurantTimezoneServer(ctx.sb, restaurantId),
  );
  const day = dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(dateYmd) ? dateYmd : today;
  const bounds = await reservationRangeIso(ctx.sb, restaurantId, day, day);
  if ("error" in bounds) {
    return { ok: false, ask: assistantAsk(locale, "whichDate") };
  }
  const q = guestName.replace(/[%_,]/g, "").trim();
  if (!q) return { ok: false, ask: assistantAsk(locale, "guest") };

  const { data, error } = await ctx.sb
    .from("reservations")
    .select("id, guest_first_name, guest_last_name, starts_at, status_id")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", bounds.startIso)
    .lt("starts_at", bounds.endIso)
    .or(`guest_first_name.ilike.%${q}%,guest_last_name.ilike.%${q}%`)
    .limit(6);
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];
  if (rows.length === 0) return { ok: false, ask: assistantAsk(locale, "guest") };
  if (rows.length > 1) {
    return {
      ok: false,
      ask: assistantAskWhich(
        locale,
        "which",
        rows.map((row) =>
          `${row.guest_first_name ?? ""} ${row.guest_last_name ?? ""}`.trim(),
        ),
      ),
    };
  }
  const row = rows[0]!;
  return {
    ok: true,
    id: row.id as string,
    label: `${row.guest_first_name ?? ""} ${row.guest_last_name ?? ""}`.trim(),
    status_id: (row.status_id as string | null) ?? null,
  };
}

export async function toolUpdateReservation(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }

  const action = String(args.action ?? "set_status").toLowerCase();
  const isCancel = action === "cancel" || action === "stornieren";
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "reservations",
    "update",
    isCancel
      ? "Keine Berechtigung, Reservierungen zu stornieren."
      : "Keine Berechtigung, Reservierungen zu ändern.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const guestName = String(args.guest_name ?? "").trim();
  const reservationId =
    typeof args.reservation_id === "string" ? args.reservation_id.trim() : "";
  let id = reservationId;
  let label = guestName;

  if (!id) {
    const found = await findReservationByGuest(
      ctx,
      target.restaurantId,
      guestName,
      typeof args.date_ymd === "string" ? args.date_ymd : null,
      locale,
    );
    if (!found.ok) {
      return assistantJson({
        ok: false,
        ask: found.ask,
        error: found.error,
      });
    }
    id = found.id;
    label = found.label;
  }

  if (isCancel) {
    const { data: statuses, error: stErr } = await target.sb
      .from("reservation_statuses")
      .select("id, code, name")
      .eq("code", "cancelled")
      .maybeSingle();
    if (stErr) return assistantJson({ ok: false, error: stErr.message });
    if (!statuses?.id) {
      return assistantJson({
        ok: false,
        error: "Status „cancelled“ nicht gefunden.",
      });
    }
    const preview = {
      reservation_id: id,
      guest_name: label,
      status_code: "cancelled",
      status_id: statuses.id,
      status_name: statuses.name,
      date_ymd: typeof args.date_ymd === "string" ? args.date_ymd : null,
    };
    if (!args.confirm) {
      return draftMutation({
      locale,
        action: "update_reservation",
        message:
          locale === "de"
            ? `Reservierung ${label} stornieren?`
            : `Cancel reservation ${label}?`,
        preview: { ...preview, mutation: "cancel" },
      });
    }
    const { error } = await target.sb
      .from("reservations")
      .update({ status_id: statuses.id })
      .eq("id", id)
      .eq("restaurant_id", target.restaurantId);
    if (error) return assistantJson({ ok: false, error: error.message });
    return assistantJson({
      ok: true,
      status: "saved",
      message:
        locale === "de"
          ? `Reservierung ${label} storniert.`
          : `Reservation ${label} cancelled.`,
    });
  }

  const statusCode = String(args.status_code ?? args.status ?? "")
    .trim()
    .toLowerCase();
  if (!statusCode) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Welchen Status soll die Reservierung bekommen?"
          : "Which status should the reservation get?",
    });
  }
  const { data: status, error: stErr } = await target.sb
    .from("reservation_statuses")
    .select("id, code, name")
    .eq("code", statusCode)
    .maybeSingle();
  if (stErr) return assistantJson({ ok: false, error: stErr.message });
  if (!status?.id) {
    return assistantJson({
      ok: false,
      error: `Unbekannter Status: ${statusCode}`,
    });
  }
  const preview = {
    reservation_id: id,
    guest_name: label,
    status_code: status.code,
    status_id: status.id,
    status_name: status.name,
    mutation: "set_status",
    date_ymd: typeof args.date_ymd === "string" ? args.date_ymd : null,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "update_reservation",
      message:
        locale === "de"
          ? `Reservierung ${label} → ${status.name}?`
          : `Set reservation ${label} to ${status.name}?`,
      preview,
    });
  }
  const { error } = await target.sb
    .from("reservations")
    .update({ status_id: status.id })
    .eq("id", id)
    .eq("restaurant_id", target.restaurantId);
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Reservierung ${label}: ${status.name}.`
        : `Reservation ${label}: ${status.name}.`,
  });
}

export async function applyUpdateReservationPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolUpdateReservation(
    ctx,
    {
      reservation_id: preview.reservation_id,
      guest_name: preview.guest_name,
      status_code: preview.status_code,
      action: preview.mutation === "cancel" ? "cancel" : "set_status",
      date_ymd: preview.date_ymd,
      confirm: true,
    },
    locale,
  );
}

export async function toolSetMenuItemActive(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "menu",
    "update",
    "Keine Berechtigung, die Speisekarte zu ändern.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const name = String(args.name ?? "").trim();
  if (!name) return assistantJson({ ok: false, ask: assistantAsk(locale, "dish") });
  const active =
    args.active === true ||
    String(args.active ?? "").toLowerCase() === "true" ||
    String(args.status ?? "").toLowerCase() === "active";
  const q = name.replace(/[%_,]/g, "");
  const { data, error } = await target.sb
    .from("menu_items")
    .select("id, name, is_active")
    .eq("restaurant_id", target.restaurantId)
    .ilike("name", `%${q}%`)
    .limit(6);
  if (error) return assistantJson({ ok: false, error: error.message });
  const rows = data ?? [];
  if (rows.length === 0) {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "dish") });
  }
  if (rows.length > 1) {
    return assistantJson({
      ok: false,
      ask: assistantAskWhich(
        locale,
        "which",
        rows.map((row) => String(row.name)),
      ),
    });
  }
  const item = rows[0]!;
  const preview = {
    menu_item_id: item.id,
    name: item.name,
    active,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "set_menu_item_active",
      message:
        locale === "de"
          ? `${item.name} ${active ? "aktivieren" : "deaktivieren"}?`
          : `${active ? "Activate" : "Deactivate"} ${item.name}?`,
      preview,
    });
  }
  const { error: upErr } = await target.sb
    .from("menu_items")
    .update({ is_active: active })
    .eq("id", item.id)
    .eq("restaurant_id", target.restaurantId);
  if (upErr) return assistantJson({ ok: false, error: upErr.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `${item.name} ist jetzt ${active ? "aktiv" : "inaktiv"}.`
        : `${item.name} is now ${active ? "active" : "inactive"}.`,
  });
}

export async function applySetMenuItemActivePreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolSetMenuItemActive(
    ctx,
    {
      name: preview.name,
      active: preview.active,
      confirm: true,
    },
    locale,
  );
}

export async function toolAdjustIngredientStock(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "inventory",
    "update",
    "Keine Berechtigung, den Bestand zu ändern.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const name = String(args.name ?? args.ingredient_name ?? "").trim();
  if (!name) return assistantJson({ ok: false, ask: assistantAsk(locale, "dish") });
  const stockRaw = args.current_stock ?? args.stock ?? args.value;
  const stock = Number(stockRaw);
  if (!Number.isFinite(stock) || stock < 0) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Auf welchen Bestand soll ich setzen?"
          : "What stock level should I set?",
    });
  }
  const q = name.replace(/[%_,]/g, "");
  const { data, error } = await target.sb
    .from("inventory_ingredients")
    .select("id, name, current_stock, unit")
    .eq("restaurant_id", target.restaurantId)
    .eq("is_active", true)
    .ilike("name", `%${q}%`)
    .limit(6);
  if (error) return assistantJson({ ok: false, error: error.message });
  const rows = data ?? [];
  if (rows.length === 0) {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "dish") });
  }
  if (rows.length > 1) {
    return assistantJson({
      ok: false,
      ask: assistantAskWhich(
        locale,
        "which",
        rows.map((row) => String(row.name)),
      ),
    });
  }
  const ing = rows[0]!;
  const preview = {
    ingredient_id: ing.id,
    name: ing.name,
    unit: ing.unit,
    previous_stock: ing.current_stock,
    current_stock: stock,
  };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "adjust_ingredient_stock",
      message:
        locale === "de"
          ? `${ing.name}: Bestand ${ing.current_stock} → ${stock} ${ing.unit ?? ""}?`.trim()
          : `${ing.name}: stock ${ing.current_stock} → ${stock} ${ing.unit ?? ""}?`.trim(),
      preview,
    });
  }
  const { error: upErr } = await target.sb
    .from("inventory_ingredients")
    .update({ current_stock: stock })
    .eq("id", ing.id)
    .eq("restaurant_id", target.restaurantId);
  if (upErr) return assistantJson({ ok: false, error: upErr.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `${ing.name}: Bestand jetzt ${stock} ${ing.unit ?? ""}`.trim()
        : `${ing.name}: stock now ${stock} ${ing.unit ?? ""}`.trim(),
  });
}

export async function applyAdjustIngredientStockPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolAdjustIngredientStock(
    ctx,
    {
      name: preview.name,
      current_stock: preview.current_stock,
      confirm: true,
    },
    locale,
  );
}

export async function toolSetPurchaseOrderStatus(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "inventory",
    "update",
    "Keine Berechtigung, Bestellungen zu ändern.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const status = String(args.status ?? "").trim().toLowerCase();
  if (!["open", "ordered", "received", "cancelled"].includes(status)) {
    return assistantJson({
      ok: false,
      ask:
        locale === "de"
          ? "Welcher Status? (open, ordered, received, cancelled)"
          : "Which status? (open, ordered, received, cancelled)",
    });
  }
  const supplier = String(args.supplier ?? args.name ?? "").trim();
  const orderId =
    typeof args.order_id === "string" ? args.order_id.trim() : "";

  let id = orderId;
  let label = supplier || orderId;

  if (!id) {
    if (!supplier) {
      return assistantJson({
        ok: false,
        ask:
          locale === "de"
            ? "Welche Bestellung / welchen Lieferanten meinst du?"
            : "Which order or supplier?",
      });
    }
    const q = supplier.replace(/[%_,]/g, "");
    const { data, error } = await target.sb
      .from("inventory_purchase_orders")
      .select("id, status, supplier_name")
      .eq("restaurant_id", target.restaurantId)
      .in("status", ["open", "ordered"])
      .ilike("supplier_name", `%${q}%`)
      .limit(6);
    if (error) return assistantJson({ ok: false, error: error.message });
    const matches = data ?? [];
    if (matches.length === 0) {
      return assistantJson({
        ok: false,
        ask:
          locale === "de"
            ? "Welche Bestellung / welchen Lieferanten meinst du?"
            : "Which order or supplier?",
      });
    }
    if (matches.length > 1) {
      return assistantJson({
        ok: false,
        ask: assistantAskWhich(
          locale,
          "which",
          matches.map((row) => String(row.supplier_name ?? row.id)),
        ),
      });
    }
    id = matches[0]!.id as string;
    label = String(matches[0]!.supplier_name ?? id);
  }

  const preview = { order_id: id, supplier: label, status };
  if (!args.confirm) {
    return draftMutation({
      locale,
      action: "set_purchase_order_status",
      message:
        locale === "de"
          ? `Bestellung ${label} → ${status}?`
          : `Order ${label} → ${status}?`,
      preview,
    });
  }
  const { error: upErr } = await target.sb
    .from("inventory_purchase_orders")
    .update({ status })
    .eq("id", id)
    .eq("restaurant_id", target.restaurantId);
  if (upErr) return assistantJson({ ok: false, error: upErr.message });
  return assistantJson({
    ok: true,
    status: "saved",
    message:
      locale === "de"
        ? `Bestellung ${label}: ${status}.`
        : `Order ${label}: ${status}.`,
  });
}

export async function applySetPurchaseOrderStatusPreview(
  ctx: AssistantToolContext,
  preview: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  return toolSetPurchaseOrderStatus(
    ctx,
    {
      order_id: preview.order_id,
      supplier: preview.supplier,
      status: preview.status,
      confirm: true,
    },
    locale,
  );
}
