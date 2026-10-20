import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OnlineOrderingSettings,
  OrderingTimeslot,
} from "@/lib/ordering/online-ordering-types";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";

function floorToInterval(date: Date, intervalMin: number): Date {
  const ms = intervalMin * 60_000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

function formatSlotLabel(start: Date, end: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("de-DE", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endFmt = new Intl.DateTimeFormat("de-DE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmt.format(start)} – ${endFmt.format(end)}`;
}

export async function listAvailableOrderingSlots(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  settings: OnlineOrderingSettings;
  fulfillmentType: "pickup" | "delivery";
}): Promise<OrderingTimeslot[]> {
  if (!params.settings.timeslotsEnabled) return [];

  const timeZone = await fetchRestaurantTimezoneServer(
    params.supabase,
    params.restaurantId,
  );
  const leadMin =
    params.fulfillmentType === "delivery"
      ? params.settings.deliveryLeadMinutes
      : params.settings.pickupLeadMinutes;
  const interval = params.settings.slotIntervalMinutes;
  const capacity = params.settings.slotCapacity;
  const horizonMs = params.settings.slotHorizonHours * 3_600_000;

  const now = new Date();
  let cursor = floorToInterval(
    new Date(now.getTime() + leadMin * 60_000),
    interval,
  );
  const horizonEnd = new Date(now.getTime() + horizonMs);

  const candidates: { start: Date; end: Date }[] = [];
  while (cursor < horizonEnd && candidates.length < 48) {
    const end = new Date(cursor.getTime() + interval * 60_000);
    candidates.push({ start: new Date(cursor), end });
    cursor = end;
  }

  if (!candidates.length) return [];

  const rangeStart = candidates[0]!.start.toISOString();
  const rangeEnd = candidates[candidates.length - 1]!.end.toISOString();

  const { data: booked } = await params.supabase
    .from("pos_orders")
    .select("slot_start_at")
    .eq("restaurant_id", params.restaurantId)
    .not("status", "eq", "cancelled")
    .not("slot_start_at", "is", null)
    .gte("slot_start_at", rangeStart)
    .lt("slot_start_at", rangeEnd);

  const counts = new Map<string, number>();
  for (const row of booked ?? []) {
    const key = String(row.slot_start_at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const slots: OrderingTimeslot[] = [];
  for (const c of candidates) {
    const key = c.start.toISOString();
    const used = counts.get(key) ?? 0;
    const remaining = Math.max(0, capacity - used);
    if (remaining <= 0) continue;
    slots.push({
      startAt: key,
      endAt: c.end.toISOString(),
      remaining,
      label: formatSlotLabel(c.start, c.end, timeZone),
    });
  }
  return slots;
}

export async function validateOrderingSlot(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  settings: OnlineOrderingSettings;
  fulfillmentType: "pickup" | "delivery";
  slotStartAt: string;
}): Promise<
  | { ok: true; slotStartAt: string; slotEndAt: string }
  | { ok: false; error: string }
> {
  if (!params.settings.timeslotsEnabled) {
    return { ok: false, error: "timeslots_disabled" };
  }
  const slots = await listAvailableOrderingSlots({
    supabase: params.supabase,
    restaurantId: params.restaurantId,
    settings: params.settings,
    fulfillmentType: params.fulfillmentType,
  });
  const match = slots.find((s) => s.startAt === params.slotStartAt);
  if (!match) return { ok: false, error: "slot_unavailable" };
  return {
    ok: true,
    slotStartAt: match.startAt,
    slotEndAt: match.endAt,
  };
}
