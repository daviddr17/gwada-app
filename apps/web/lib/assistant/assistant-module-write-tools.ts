import "server-only";

import { assistantAsk, assistantAskWhich } from "@/lib/assistant/assistant-ask";
import { resolveAssistantTarget } from "@/lib/assistant/assistant-scope";
import {
  assistantJson,
  denyUnlessModuleCrud,
  draftMutation,
} from "@/lib/assistant/assistant-tool-auth";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import type { AppLocale } from "@/i18n/config";

export {
  applyUpdateReservationPreview,
  toolUpdateReservation,
} from "@/lib/assistant/assistant-reservation-write-tools";

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
