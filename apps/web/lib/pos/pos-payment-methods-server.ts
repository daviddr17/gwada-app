import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PosRestaurantPaymentMethodDto,
  PosRestaurantPaymentMethodKind,
  PosRestaurantPaymentMethodRow,
} from "@/lib/types/pos-payment-methods";
import {
  isPosPaymentMethodCollectable,
  posPaymentMethodEnumForKind,
  posPaymentMethodFiscalClass,
} from "@/lib/types/pos-payment-methods";

const SYSTEM_PRESETS: ReadonlyArray<{
  kind: "cash" | "unbar" | "voucher";
  label: string;
  sort_order: number;
}> = [
  { kind: "cash", label: "Bar", sort_order: 0 },
  { kind: "unbar", label: "Unbar", sort_order: 1 },
  { kind: "voucher", label: "Gutschein", sort_order: 2 },
];

function mapRow(row: Record<string, unknown>): PosRestaurantPaymentMethodRow {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    kind: row.kind as PosRestaurantPaymentMethodKind,
    label: String(row.label),
    sort_order: Number(row.sort_order),
    is_active: Boolean(row.is_active),
    is_system: Boolean(row.is_system),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toDto(row: PosRestaurantPaymentMethodRow): PosRestaurantPaymentMethodDto {
  return {
    ...row,
    collectable: isPosPaymentMethodCollectable(row.kind) && row.is_active,
    fiscalClass: posPaymentMethodFiscalClass(row.kind),
  };
}

export async function ensurePosRestaurantPaymentMethods(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  for (const preset of SYSTEM_PRESETS) {
    const { data } = await sb
      .from("pos_restaurant_payment_methods")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("kind", preset.kind)
      .eq("is_system", true)
      .maybeSingle();

    if (!data) {
      await sb.from("pos_restaurant_payment_methods").insert({
        restaurant_id: restaurantId,
        kind: preset.kind,
        label: preset.label,
        sort_order: preset.sort_order,
        is_active: true,
        is_system: true,
      });
    }
  }
}

export async function listPosRestaurantPaymentMethods(
  sb: SupabaseClient,
  restaurantId: string,
  opts?: { activeOnly?: boolean },
): Promise<PosRestaurantPaymentMethodDto[]> {
  await ensurePosRestaurantPaymentMethods(sb, restaurantId);

  let query = sb
    .from("pos_restaurant_payment_methods")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (opts?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data } = await query;
  return (data ?? []).map((row) => toDto(mapRow(row as Record<string, unknown>)));
}

export async function getPosRestaurantPaymentMethod(
  sb: SupabaseClient,
  restaurantId: string,
  methodId: string,
): Promise<PosRestaurantPaymentMethodDto | null> {
  await ensurePosRestaurantPaymentMethods(sb, restaurantId);
  const { data } = await sb
    .from("pos_restaurant_payment_methods")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", methodId)
    .maybeSingle();
  return data ? toDto(mapRow(data as Record<string, unknown>)) : null;
}

export async function getSystemPosPaymentMethod(
  sb: SupabaseClient,
  restaurantId: string,
  kind: "cash" | "unbar" | "voucher",
): Promise<PosRestaurantPaymentMethodDto | null> {
  await ensurePosRestaurantPaymentMethods(sb, restaurantId);
  const { data } = await sb
    .from("pos_restaurant_payment_methods")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("kind", kind)
    .eq("is_system", true)
    .maybeSingle();
  return data ? toDto(mapRow(data as Record<string, unknown>)) : null;
}

export async function createCustomPosPaymentMethod(
  sb: SupabaseClient,
  restaurantId: string,
  label: string,
): Promise<
  | { ok: true; method: PosRestaurantPaymentMethodDto }
  | { ok: false; error: string; status: number }
> {
  const trimmed = label.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    return { ok: false, error: "invalid_label", status: 400 };
  }

  await ensurePosRestaurantPaymentMethods(sb, restaurantId);

  const { data: existing } = await sb
    .from("pos_restaurant_payment_methods")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = Number(existing?.sort_order ?? 2) + 1;

  const { data, error } = await sb
    .from("pos_restaurant_payment_methods")
    .insert({
      restaurant_id: restaurantId,
      kind: "custom",
      label: trimmed,
      sort_order: sortOrder,
      is_active: true,
      is_system: false,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "create_failed", status: 500 };
  }

  return { ok: true, method: toDto(mapRow(data as Record<string, unknown>)) };
}

export async function updatePosPaymentMethod(
  sb: SupabaseClient,
  restaurantId: string,
  methodId: string,
  patch: Partial<{ label: string; is_active: boolean; sort_order: number }>,
): Promise<
  | { ok: true; method: PosRestaurantPaymentMethodDto }
  | { ok: false; error: string; status: number }
> {
  const current = await getPosRestaurantPaymentMethod(sb, restaurantId, methodId);
  if (!current) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const next: Record<string, unknown> = {};

  if (patch.label !== undefined) {
    const trimmed = patch.label.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      return { ok: false, error: "invalid_label", status: 400 };
    }
    // System-Presets: Label darf umbenannt werden (z. B. Unbar → Adyen später)
    next.label = trimmed;
  }

  if (patch.is_active !== undefined) {
    // System-Presets bleiben aktivierbar/deaktivierbar außer wir erzwingen cash?
    // Bar/Gutschein/Unbar sollen sichtbar bleiben — Deaktivieren erlauben für Unbar ok,
    // Bar und Gutschein sollten aktiv bleiben.
    if (
      current.is_system &&
      (current.kind === "cash" || current.kind === "voucher") &&
      patch.is_active === false
    ) {
      return { ok: false, error: "system_method_required", status: 400 };
    }
    next.is_active = patch.is_active;
  }

  if (patch.sort_order !== undefined) {
    next.sort_order = Math.round(patch.sort_order);
  }

  if (Object.keys(next).length === 0) {
    return { ok: true, method: current };
  }

  const { data, error } = await sb
    .from("pos_restaurant_payment_methods")
    .update(next)
    .eq("id", methodId)
    .eq("restaurant_id", restaurantId)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "update_failed", status: 500 };
  }

  return { ok: true, method: toDto(mapRow(data as Record<string, unknown>)) };
}

export async function deleteCustomPosPaymentMethod(
  sb: SupabaseClient,
  restaurantId: string,
  methodId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const current = await getPosRestaurantPaymentMethod(sb, restaurantId, methodId);
  if (!current) {
    return { ok: false, error: "not_found", status: 404 };
  }
  if (current.is_system) {
    return { ok: false, error: "system_method_not_deletable", status: 400 };
  }

  const { error } = await sb
    .from("pos_restaurant_payment_methods")
    .delete()
    .eq("id", methodId)
    .eq("restaurant_id", restaurantId)
    .eq("is_system", false);

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }
  return { ok: true };
}

export {
  posPaymentMethodEnumForKind,
  posPaymentMethodFiscalClass,
};
