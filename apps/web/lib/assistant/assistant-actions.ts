import type { AppLocale } from "../../i18n/config";
import type { DayHours, Weekday } from "../types/restaurant";

export type AssistantReservationPreview = {
  date_ymd: string;
  time_hm: string;
  party_size: number;
  guest_first_name: string;
  guest_last_name: string | null;
  guest_phone: string | null;
  notes: string | null;
  restaurant_name: string | null;
};

export type AssistantOpeningHoursDayChange = {
  weekday: Weekday;
  closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
};

export type AssistantOpeningHoursExceptionChange = {
  date_ymd: string;
  closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  note: string | null;
  remove?: boolean;
};

export type AssistantOpeningHoursPreview = {
  restaurant_name: string | null;
  weekly_changes: AssistantOpeningHoursDayChange[];
  exception_changes: AssistantOpeningHoursExceptionChange[];
  next_weekly: Record<Weekday, DayHours>;
  next_exceptions: Array<{
    id: string;
    date: string;
    closed: boolean;
    open?: string;
    close?: string;
    note?: string;
  }>;
  kitchenHoursEnabled: boolean;
  kitchenWeeklyHours: Record<Weekday, DayHours>;
};

export type AssistantPendingAction =
  | {
      kind: "create_reservation";
      summary: string;
      preview: AssistantReservationPreview;
    }
  | {
      kind: "update_opening_hours";
      summary: string;
      preview: AssistantOpeningHoursPreview;
    };

export function reservationPreviewSummary(
  preview: AssistantReservationPreview,
  locale: AppLocale,
): string {
  const name = [preview.guest_first_name, preview.guest_last_name]
    .filter(Boolean)
    .join(" ");
  const house = preview.restaurant_name ? `${preview.restaurant_name}: ` : "";
  if (locale === "de") {
    return `${house}Reservierung am ${preview.date_ymd} um ${preview.time_hm}, ${preview.party_size} Personen, ${name}.`;
  }
  return `${house}Reservation on ${preview.date_ymd} at ${preview.time_hm}, ${preview.party_size} guests, ${name}.`;
}

function isOpeningHoursPreview(
  preview: unknown,
): preview is AssistantOpeningHoursPreview {
  if (!preview || typeof preview !== "object") return false;
  const p = preview as AssistantOpeningHoursPreview;
  return (
    Array.isArray(p.weekly_changes) &&
    Array.isArray(p.exception_changes) &&
    p.next_weekly != null &&
    typeof p.next_weekly === "object"
  );
}

export function pendingActionFromToolJson(
  raw: string,
): AssistantPendingAction | null {
  try {
    const parsed = JSON.parse(raw) as {
      status?: string;
      preview?: unknown;
      message?: string;
    };
    if (parsed.status !== "draft" || !parsed.preview) return null;

    if (isOpeningHoursPreview(parsed.preview)) {
      const preview = parsed.preview;
      if (!preview.weekly_changes.length && !preview.exception_changes.length) {
        return null;
      }
      return {
        kind: "update_opening_hours",
        summary:
          parsed.message?.trim() ||
          (preview.restaurant_name
            ? `${preview.restaurant_name}: Öffnungszeiten ändern.`
            : "Öffnungszeiten ändern."),
        preview,
      };
    }

    const preview = parsed.preview as AssistantReservationPreview;
    if (!preview.date_ymd || !preview.guest_first_name || !preview.time_hm) {
      return null;
    }
    return {
      kind: "create_reservation",
      summary: parsed.message?.trim() || reservationPreviewSummary(preview, "de"),
      preview,
    };
  } catch {
    return null;
  }
}

export function askFromToolJson(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { ask?: string; status?: string };
    if (parsed.status === "draft") return null;
    const ask = parsed.ask?.trim();
    return ask || null;
  } catch {
    return null;
  }
}

/** One open question waits. A save draft is shown only when this turn has no question. */
export function settleAssistantToolPayloads(
  reply: string,
  toolPayloads: string[],
): { reply: string; pendingAction: AssistantPendingAction | null } {
  let pending: AssistantPendingAction | null = null;
  let ask: string | null = null;
  for (const raw of toolPayloads) {
    if (!ask) {
      const nextAsk = askFromToolJson(raw);
      if (nextAsk) ask = nextAsk;
    }
    if (!pending) {
      const draft = pendingActionFromToolJson(raw);
      if (draft) pending = draft;
    }
  }
  if (ask) return { reply: ask, pendingAction: null };
  if (pending) return { reply: pending.summary, pendingAction: pending };
  return { reply, pendingAction: null };
}
