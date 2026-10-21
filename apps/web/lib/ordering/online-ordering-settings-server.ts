import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_NOTIFY_STATUSES,
  DEFAULT_ONLINE_ORDERING_SETTINGS,
  type DeliveryZone,
  type OnlineOrderingSettings,
  type OnlineOrderingSettingsPatch,
} from "@/lib/ordering/online-ordering-types";

function parseZones(raw: unknown): DeliveryZone[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliveryZone[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const postalCode = String(r.postalCode ?? r.postal_code ?? "")
      .trim()
      .replace(/\s+/g, "");
    if (!postalCode) continue;
    const fee =
      typeof r.feeCents === "number"
        ? r.feeCents
        : typeof r.fee_cents === "number"
          ? r.fee_cents
          : undefined;
    const min =
      typeof r.minOrderCents === "number"
        ? r.minOrderCents
        : typeof r.min_order_cents === "number"
          ? r.min_order_cents
          : undefined;
    out.push({
      postalCode,
      ...(typeof fee === "number" && fee >= 0 ? { feeCents: Math.round(fee) } : {}),
      ...(typeof min === "number" && min >= 0
        ? { minOrderCents: Math.round(min) }
        : {}),
    });
  }
  return out;
}

function parseNotifyStatuses(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_NOTIFY_STATUSES];
  const out = raw
    .map((x) => String(x))
    .filter((s) => DEFAULT_NOTIFY_STATUSES.includes(s as (typeof DEFAULT_NOTIFY_STATUSES)[number]) || s.length > 0);
  return out.length ? out : [...DEFAULT_NOTIFY_STATUSES];
}

function rowToSettings(
  restaurantId: string,
  row: Record<string, unknown> | null,
): OnlineOrderingSettings {
  if (!row) {
    return { restaurantId, ...DEFAULT_ONLINE_ORDERING_SETTINGS };
  }
  return {
    restaurantId,
    onlineEnabled: Boolean(row.online_enabled),
    kioskEnabled: Boolean(row.kiosk_enabled),
    pickupEnabled: row.pickup_enabled !== false,
    deliveryEnabled: Boolean(row.delivery_enabled),
    minOrderCentsPickup: Math.max(0, Number(row.min_order_cents_pickup) || 0),
    minOrderCentsDelivery: Math.max(
      0,
      Number(row.min_order_cents_delivery) || 0,
    ),
    deliveryFeeCents: Math.max(0, Number(row.delivery_fee_cents) || 0),
    deliveryZones: parseZones(row.delivery_zones),
    pickupLeadMinutes: Math.max(0, Number(row.pickup_lead_minutes) || 20),
    deliveryLeadMinutes: Math.max(0, Number(row.delivery_lead_minutes) || 45),
    kioskIdleSeconds: Math.max(30, Number(row.kiosk_idle_seconds) || 90),
    guestStatusMessage:
      typeof row.guest_status_message === "string"
        ? row.guest_status_message
        : null,
    notifyWhatsappEnabled: row.notify_whatsapp_enabled !== false,
    notifyEmailEnabled: row.notify_email_enabled !== false,
    notifyStatuses: parseNotifyStatuses(row.notify_statuses),
    timeslotsEnabled: Boolean(row.timeslots_enabled),
    slotIntervalMinutes: Math.min(
      120,
      Math.max(5, Number(row.slot_interval_minutes) || 15),
    ),
    slotCapacity: Math.min(200, Math.max(1, Number(row.slot_capacity) || 8)),
    slotHorizonHours: Math.min(
      168,
      Math.max(1, Number(row.slot_horizon_hours) || 24),
    ),
    kioskMollieTerminalId:
      typeof row.kiosk_mollie_terminal_id === "string" &&
      row.kiosk_mollie_terminal_id.startsWith("term_")
        ? row.kiosk_mollie_terminal_id
        : null,
  };
}

export async function loadOnlineOrderingSettings(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<OnlineOrderingSettings> {
  const { data, error } = await supabase
    .from("restaurant_online_ordering_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    console.warn("[ordering] load settings", error.message);
  }
  return rowToSettings(restaurantId, (data as Record<string, unknown>) ?? null);
}

export async function upsertOnlineOrderingSettings(
  supabase: SupabaseClient,
  restaurantId: string,
  patch: OnlineOrderingSettingsPatch,
): Promise<
  | { ok: true; settings: OnlineOrderingSettings }
  | { ok: false; error: string; status: number }
> {
  const current = await loadOnlineOrderingSettings(supabase, restaurantId);
  const next: OnlineOrderingSettings = {
    ...current,
    ...patch,
    restaurantId,
    deliveryZones: patch.deliveryZones ?? current.deliveryZones,
    notifyStatuses: patch.notifyStatuses ?? current.notifyStatuses,
  };

  if (next.kioskIdleSeconds < 30) {
    return { ok: false, error: "invalid_kiosk_idle", status: 400 };
  }

  const payload = {
    restaurant_id: restaurantId,
    online_enabled: next.onlineEnabled,
    kiosk_enabled: next.kioskEnabled,
    pickup_enabled: next.pickupEnabled,
    delivery_enabled: next.deliveryEnabled,
    min_order_cents_pickup: next.minOrderCentsPickup,
    min_order_cents_delivery: next.minOrderCentsDelivery,
    delivery_fee_cents: next.deliveryFeeCents,
    delivery_zones: next.deliveryZones,
    pickup_lead_minutes: next.pickupLeadMinutes,
    delivery_lead_minutes: next.deliveryLeadMinutes,
    kiosk_idle_seconds: next.kioskIdleSeconds,
    guest_status_message: next.guestStatusMessage,
    notify_whatsapp_enabled: next.notifyWhatsappEnabled,
    notify_email_enabled: next.notifyEmailEnabled,
    notify_statuses: next.notifyStatuses,
    timeslots_enabled: next.timeslotsEnabled,
    slot_interval_minutes: next.slotIntervalMinutes,
    slot_capacity: next.slotCapacity,
    slot_horizon_hours: next.slotHorizonHours,
    kiosk_mollie_terminal_id: next.kioskMollieTerminalId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("restaurant_online_ordering_settings")
    .upsert(payload, { onConflict: "restaurant_id" });

  if (error) {
    console.warn("[ordering] upsert settings", error.message);
    return { ok: false, error: "save_failed", status: 500 };
  }

  return { ok: true, settings: next };
}

export function publicOrderingSettingsView(settings: OnlineOrderingSettings) {
  return {
    onlineEnabled: settings.onlineEnabled,
    kioskEnabled: settings.kioskEnabled,
    pickupEnabled: settings.pickupEnabled,
    deliveryEnabled: settings.deliveryEnabled,
    minOrderCentsPickup: settings.minOrderCentsPickup,
    minOrderCentsDelivery: settings.minOrderCentsDelivery,
    deliveryFeeCents: settings.deliveryFeeCents,
    deliveryZones: settings.deliveryZones.map((z) => ({
      postalCode: z.postalCode,
      feeCents: z.feeCents ?? settings.deliveryFeeCents,
      minOrderCents: z.minOrderCents ?? settings.minOrderCentsDelivery,
    })),
    pickupLeadMinutes: settings.pickupLeadMinutes,
    deliveryLeadMinutes: settings.deliveryLeadMinutes,
    kioskIdleSeconds: settings.kioskIdleSeconds,
    guestStatusMessage: settings.guestStatusMessage,
    hasKioskTerminal: Boolean(settings.kioskMollieTerminalId),
  };
}

export function resolveDeliveryFeeCents(
  settings: OnlineOrderingSettings,
  postalCode: string | undefined,
): { ok: true; feeCents: number; minOrderCents: number } | { ok: false; error: string } {
  const code = (postalCode ?? "").trim().replace(/\s+/g, "");
  if (!code) return { ok: false, error: "postal_code_required" };

  const zones = settings.deliveryZones;
  if (zones.length > 0) {
    const zone = zones.find(
      (z) => z.postalCode.replace(/\s+/g, "") === code,
    );
    if (!zone) return { ok: false, error: "outside_delivery_zone" };
    return {
      ok: true,
      feeCents: zone.feeCents ?? settings.deliveryFeeCents,
      minOrderCents: zone.minOrderCents ?? settings.minOrderCentsDelivery,
    };
  }

  return {
    ok: true,
    feeCents: settings.deliveryFeeCents,
    minOrderCents: settings.minOrderCentsDelivery,
  };
}
