import { COUNTRIES_REFERENCE_FALLBACK } from "@/lib/constants/countries";
import {
  hhmmToMinutes,
  openingDaySlotStartsMinutes,
  resolveHoursForLocalCalendarDay,
} from "@/lib/reservations/day-opening-slots";
import type {
  DateHoursException,
  DayHours,
  Weekday,
} from "@/lib/types/restaurant";

export type PublicEmbedRestaurant = {
  id: string;
  name: string;
  slug: string;
  accentHex: string;
  defaultDwellMinutes: number;
  /** Mindest-Vorlauf in Stunden (ab „jetzt“) für öffentliche Buchungen. */
  bookingLeadTimeHours: number;
  /** Spätester Beginn: Schließzeit minus diese Minuten. */
  minMinutesBeforeClosing: number;
  /** Optional unter dem Embed-Formular. */
  embedFormFooterText: string | null;
  weeklyHours: Record<Weekday, DayHours>;
  dateExceptions: DateHoursException[];
};

export type PublicGuestReservation = {
  id: string;
  reservation_number: number;
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  dwell_minutes: number | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
  status_code: string;
  dining_table_id: string | null;
};

export type PublicReservationCreateBody = {
  slug: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
  website?: string;
};

export type PublicReservationUpdateBody = {
  slug: string;
  reservation_number: number;
  pin: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
  website?: string;
};

export function normalizeMinMinutesBeforeClosing(
  value: number | null | undefined,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 60;
  return Math.min(480, Math.max(0, Math.round(value)));
}

/** Entfernt Slots, die näher als `minMinutesBeforeClosing` an der Schließzeit liegen. */
export function filterSlotsForMinMinutesBeforeClosing(
  slots: string[],
  config: Pick<PublicEmbedRestaurant, "weeklyHours" | "dateExceptions">,
  day: Date,
  minMinutesBeforeClosing: number,
): string[] {
  const buffer = normalizeMinMinutesBeforeClosing(minMinutesBeforeClosing);
  if (buffer <= 0 || slots.length === 0) return slots;

  const hours = resolveHoursForLocalCalendarDay(
    day,
    config.weeklyHours,
    config.dateExceptions,
  );
  if (hours.closed || !hours.close?.trim()) return slots;

  const latestStartM = hhmmToMinutes(hours.close) - buffer;
  return slots.filter((hm) => hhmmToMinutes(hm) <= latestStartM);
}

export function publicTimeSlotsForDay(
  config: Pick<PublicEmbedRestaurant, "weeklyHours" | "dateExceptions">,
  day: Date,
): string[] {
  const hours = resolveHoursForLocalCalendarDay(
    day,
    config.weeklyHours,
    config.dateExceptions,
  );
  const fallback = {
    openMin: 11 * 60 + 30,
    closeMin: 22 * 60,
  };
  if (hours.closed) return [];
  return openingDaySlotStartsMinutes(hours, fallback, 15).map((m) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  });
}

export function publicCountries() {
  return COUNTRIES_REFERENCE_FALLBACK;
}

/** Prüft, ob gewählte Zeit in Öffnungszeiten liegt (grobe Validierung). */
export function isStartWithinOpeningHours(
  config: Pick<PublicEmbedRestaurant, "weeklyHours" | "dateExceptions">,
  startsAtIso: string,
): boolean {
  const d = new Date(startsAtIso);
  const slots = publicTimeSlotsForDay(config, d);
  if (slots.length === 0) return false;
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const minutes = hhmmToMinutes(hm);
  const hours = resolveHoursForLocalCalendarDay(
    d,
    config.weeklyHours,
    config.dateExceptions,
  );
  if (hours.closed || !hours.open || !hours.close) return false;
  const openM = hhmmToMinutes(hours.open);
  const closeM = hhmmToMinutes(hours.close);
  return minutes >= openM && minutes < closeM;
}
