import {
  filterSlotsForMinMinutesBeforeClosing,
  publicTimeSlotsForDay,
  type PublicEmbedRestaurant,
} from "@/lib/reservations/public-embed-shared";
import { localDayToYmd } from "@/lib/reservations/datetime-local";

export type PublicEmbedBookingConfig = Pick<
  PublicEmbedRestaurant,
  | "weeklyHours"
  | "dateExceptions"
  | "bookingLeadTimeHours"
  | "minMinutesBeforeClosing"
>;

const MAX_SLOT_SEARCH_DAYS = 90;

/** Morgen, Uhrzeit auf nächste volle Stunde gerundet (lokale Zeit). */
export function defaultEmbedBookingYmdHm(): { ymd: string; hm: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getMinutes() !== 0 || d.getSeconds() !== 0 || d.getMilliseconds() !== 0) {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0, 0, 0);
  }
  const hm = `${String(d.getHours()).padStart(2, "0")}:00`;
  return { ymd: localDayToYmd(d), hm };
}

export function normalizeBookingLeadTimeHours(
  value: number | null | undefined,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 2;
  return Math.min(168, Math.max(0, value));
}

/** Frühester erlaubter Buchungsbeginn (lokale Browser-/Server-Zeit des Clients bzw. UTC→local bei ISO). */
export function minimumBookingStartsAt(leadTimeHours: number, now = new Date()): Date {
  const ms = normalizeBookingLeadTimeHours(leadTimeHours) * 60 * 60 * 1000;
  return new Date(now.getTime() + ms);
}

export function isStartsAtWithinBookingLeadTime(
  startsAtIso: string,
  leadTimeHours: number,
  now = new Date(),
): boolean {
  const starts = new Date(startsAtIso).getTime();
  if (!Number.isFinite(starts)) return false;
  return starts >= minimumBookingStartsAt(leadTimeHours, now).getTime();
}

function ymdHmToLocalDate(ymd: string, hm: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, min] = hm.split(":").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0, 0, 0);
}

/** Öffnungs-Slots mit Schließ-Puffer und optional Vorlaufzeit. */
export function filterPublicBookableTimeSlots(
  config: PublicEmbedBookingConfig,
  dateYmd: string,
  options?: { enforceLeadTime?: boolean; now?: Date },
): string[] {
  const now = options?.now ?? new Date();
  const day = ymdHmToLocalDate(dateYmd, "12:00");
  let slots = publicTimeSlotsForDay(config, day);
  slots = filterSlotsForMinMinutesBeforeClosing(
    slots,
    config,
    day,
    config.minMinutesBeforeClosing,
  );
  if (options?.enforceLeadTime === false) return slots;
  const minAt = minimumBookingStartsAt(config.bookingLeadTimeHours, now).getTime();
  return slots.filter((hm) => ymdHmToLocalDate(dateYmd, hm).getTime() >= minAt);
}

/** @deprecated Nutze {@link filterPublicBookableTimeSlots}. */
export function filterTimeSlotsForBookingLead(
  config: PublicEmbedBookingConfig,
  dateYmd: string,
  leadTimeHours: number,
  now = new Date(),
): string[] {
  return filterPublicBookableTimeSlots(
    { ...config, bookingLeadTimeHours: leadTimeHours },
    dateYmd,
    { enforceLeadTime: true, now },
  );
}

export function isStartPublicBookable(
  config: PublicEmbedBookingConfig & Pick<PublicEmbedRestaurant, "weeklyHours" | "dateExceptions">,
  startsAtIso: string,
  now = new Date(),
): boolean {
  const d = new Date(startsAtIso);
  if (!Number.isFinite(d.getTime())) return false;
  const ymd = localDayToYmd(d);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return filterPublicBookableTimeSlots(config, ymd, { enforceLeadTime: true, now }).includes(
    hm,
  );
}

/** Frühestes wählbares Datum (`yyyy-MM-dd`) für den DatePicker. */
export function earliestBookableYmd(
  config: PublicEmbedBookingConfig,
  now = new Date(),
): string {
  const first = firstBookableEmbedSlot(config, now);
  return first?.ymd ?? localDayToYmd(now);
}

/** Erster buchbarer Slot (Öffnungszeiten, Schließ-Puffer, Vorlauf). */
export function firstBookableEmbedSlot(
  config: PublicEmbedBookingConfig,
  now = new Date(),
): { ymd: string; hm: string } | null {
  const minAt = minimumBookingStartsAt(config.bookingLeadTimeHours, now);
  const startYmd = localDayToYmd(minAt);
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  const cursor = new Date(sy!, (sm ?? 1) - 1, sd ?? 1);

  for (let i = 0; i < MAX_SLOT_SEARCH_DAYS; i++) {
    const ymd = localDayToYmd(cursor);
    const slots = filterPublicBookableTimeSlots(config, ymd, { now });
    if (slots.length > 0) {
      return { ymd, hm: slots[0]! };
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

/** Standard-Datum/Uhrzeit fürs Embed. */
export function resolveEmbedBookingDefaultYmdHm(
  config: PublicEmbedBookingConfig,
  now = new Date(),
): { ymd: string; hm: string } {
  const preferred = defaultEmbedBookingYmdHm();
  const preferredMs = ymdHmToLocalDate(preferred.ymd, preferred.hm).getTime();
  const minAt = minimumBookingStartsAt(config.bookingLeadTimeHours, now).getTime();

  if (preferredMs >= minAt) {
    const slots = filterPublicBookableTimeSlots(config, preferred.ymd, { now });
    if (slots.includes(preferred.hm)) return preferred;
    if (slots.length > 0) return { ymd: preferred.ymd, hm: slots[0]! };
  }

  const first = firstBookableEmbedSlot(config, now);
  if (first) return first;

  return preferred;
}

/** Prüft Datum/Uhrzeit gegen alle Buchungsregeln (inkl. Vorlauf). */
export function isYmdHmPublicBookable(
  config: PublicEmbedBookingConfig,
  dateYmd: string,
  timeHm: string,
  now = new Date(),
): boolean {
  return filterPublicBookableTimeSlots(config, dateYmd, { now }).includes(timeHm);
}

/** @deprecated Nutze {@link isYmdHmPublicBookable}. */
export function isYmdHmWithinBookingLead(
  config: PublicEmbedBookingConfig,
  dateYmd: string,
  timeHm: string,
  leadTimeHours: number,
  now = new Date(),
): boolean {
  return isYmdHmPublicBookable(
    { ...config, bookingLeadTimeHours: leadTimeHours },
    dateYmd,
    timeHm,
    now,
  );
}

export function ymdToLocalDayStart(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function isYmdBeforeEarliestBookable(
  dateYmd: string,
  earliestYmd: string,
): boolean {
  return ymdToLocalDayStart(dateYmd).getTime() < ymdToLocalDayStart(earliestYmd).getTime();
}
