import type { PosFulfillmentType } from "@gwada/pos-domain";
import type { OnlineOrderingSettings } from "@/lib/ordering/online-ordering-types";

/** Max how far ahead a Wunschzeit may be booked (days). */
export const ORDERING_WUNSCHZEIT_MAX_DAYS = 7;

export function leadMinutesForFulfillment(
  settings: Pick<
    OnlineOrderingSettings,
    "pickupLeadMinutes" | "deliveryLeadMinutes"
  >,
  fulfillment: PosFulfillmentType,
): number {
  if (fulfillment === "delivery") {
    return Math.max(0, settings.deliveryLeadMinutes);
  }
  return Math.max(0, settings.pickupLeadMinutes);
}

/** Earliest ready/pickup/delivery moment = now + Mindestvorlauf. */
export function earliestReadyAt(
  settings: Pick<
    OnlineOrderingSettings,
    "pickupLeadMinutes" | "deliveryLeadMinutes"
  >,
  fulfillment: PosFulfillmentType,
  nowMs: number = Date.now(),
): Date {
  const lead = leadMinutesForFulfillment(settings, fulfillment);
  return new Date(nowMs + lead * 60_000);
}

export function formatEarliestLabelDe(earliest: Date): string {
  return earliest.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatOrderTimingLabelDe(params: {
  fulfillmentAsap: boolean;
  slotStartAt: string | null;
}): string {
  if (params.fulfillmentAsap) {
    if (!params.slotStartAt) return "Schnellstmöglich";
    const t = new Date(params.slotStartAt).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Schnellstmöglich (ca. ${t})`;
  }
  if (!params.slotStartAt) return "Wunschzeit";
  const formatted = new Date(params.slotStartAt).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
  return `Wunschzeit: ${formatted}`;
}

export type ResolveGuestTimingResult =
  | {
      ok: true;
      fulfillmentAsap: boolean;
      slotStartAt: string;
      slotEndAt: null;
    }
  | { ok: false; error: string };

/**
 * Online: asap | scheduled. Kiosk/table: always asap.
 * slot_start_at always stores the target moment (earliest or Wunschzeit).
 */
export function resolveGuestOrderTiming(params: {
  channel: "online" | "kiosk" | "table";
  fulfillment: PosFulfillmentType;
  settings: Pick<
    OnlineOrderingSettings,
    "pickupLeadMinutes" | "deliveryLeadMinutes"
  >;
  timingMode?: "asap" | "scheduled" | string | null;
  scheduledAt?: string | null;
  nowMs?: number;
}): ResolveGuestTimingResult {
  const nowMs = params.nowMs ?? Date.now();
  const earliest = earliestReadyAt(
    params.settings,
    params.fulfillment,
    nowMs,
  );
  const forceAsap = params.channel !== "online";
  const mode =
    forceAsap || params.timingMode !== "scheduled" ? "asap" : "scheduled";

  if (mode === "asap") {
    return {
      ok: true,
      fulfillmentAsap: true,
      slotStartAt: earliest.toISOString(),
      slotEndAt: null,
    };
  }

  const raw = params.scheduledAt?.trim() ?? "";
  if (!raw) {
    return { ok: false, error: "scheduled_at_required" };
  }
  const scheduled = new Date(raw);
  if (Number.isNaN(scheduled.getTime())) {
    return { ok: false, error: "scheduled_at_invalid" };
  }

  // 60s skew so "earliest" from client/server clock drift is accepted
  if (scheduled.getTime() < earliest.getTime() - 60_000) {
    return { ok: false, error: "scheduled_before_earliest" };
  }

  const maxMs = nowMs + ORDERING_WUNSCHZEIT_MAX_DAYS * 24 * 60 * 60 * 1000;
  if (scheduled.getTime() > maxMs) {
    return { ok: false, error: "scheduled_too_far" };
  }

  return {
    ok: true,
    fulfillmentAsap: false,
    slotStartAt: scheduled.toISOString(),
    slotEndAt: null,
  };
}

/** Value for `<input type="datetime-local">` in local timezone. */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
