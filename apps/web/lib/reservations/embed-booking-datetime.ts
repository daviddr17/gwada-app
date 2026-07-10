import {
  DEFAULT_RESTAURANT_TIMEZONE,
  addRestaurantCalendarDaysYmd,
  readRestaurantZonedParts,
  restaurantTodayYmd,
  ymdHmToRestaurantIso,
} from "@/lib/restaurant/restaurant-timezone";
import {
  filterSlotsForMinMinutesBeforeClosing,
  publicTimeSlotsForYmd,
  type PublicEmbedRestaurant,
} from "@/lib/reservations/public-embed-shared";

export type PublicEmbedBookingConfig = Pick<
  PublicEmbedRestaurant,
  | "weeklyHours"
  | "dateExceptions"
  | "bookingLeadTimeHours"
  | "minMinutesBeforeClosing"
  | "timezone"
>;

const MAX_SLOT_SEARCH_DAYS = 90;

function configTimeZone(config: PublicEmbedBookingConfig): string {
  return config.timezone?.trim() || DEFAULT_RESTAURANT_TIMEZONE;
}

function ymdHmToInstant(
  ymd: string,
  hm: string,
  timeZone: string,
): Date {
  return new Date(ymdHmToRestaurantIso(ymd, hm, timeZone));
}

/** Morgen, Uhrzeit auf nächste volle Stunde gerundet (Restaurant-Zeit). */
export function defaultEmbedBookingYmdHm(
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
  now = new Date(),
): { ymd: string; hm: string } {
  const todayYmd = restaurantTodayYmd(timeZone, now);
  const tomorrowYmd = addRestaurantCalendarDaysYmd(todayYmd, 1, timeZone);
  const z = readRestaurantZonedParts(now, timeZone);
  let hour = z.hour;
  if (z.minute !== 0) {
    hour += 1;
  }
  const hm = `${String(Math.min(hour, 23)).padStart(2, "0")}:00`;
  return { ymd: tomorrowYmd, hm };
}

export function normalizeBookingLeadTimeHours(
  value: number | null | undefined,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 2;
  return Math.min(168, Math.max(0, value));
}

/** Frühester erlaubter Buchungsbeginn (Restaurant-Zeitzone). */
export function minimumBookingStartsAt(
  leadTimeHours: number,
  now = new Date(),
): Date {
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

/** Öffnungs-Slots mit Schließ-Puffer und optional Vorlaufzeit. */
export function filterPublicBookableTimeSlots(
  config: PublicEmbedBookingConfig,
  dateYmd: string,
  options?: { enforceLeadTime?: boolean; now?: Date },
): string[] {
  const now = options?.now ?? new Date();
  const timeZone = configTimeZone(config);
  let slots = publicTimeSlotsForYmd(config, dateYmd);
  slots = filterSlotsForMinMinutesBeforeClosing(
    slots,
    config,
    dateYmd,
    config.minMinutesBeforeClosing,
  );
  if (options?.enforceLeadTime === false) return slots;
  const minAt = minimumBookingStartsAt(config.bookingLeadTimeHours, now).getTime();
  return slots.filter(
    (hm) => ymdHmToInstant(dateYmd, hm, timeZone).getTime() >= minAt,
  );
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
  config: PublicEmbedBookingConfig &
    Pick<PublicEmbedRestaurant, "weeklyHours" | "dateExceptions">,
  startsAtIso: string,
  now = new Date(),
): boolean {
  const timeZone = configTimeZone(config);
  const d = new Date(startsAtIso);
  if (!Number.isFinite(d.getTime())) return false;
  const z = readRestaurantZonedParts(d, timeZone);
  const ymd = `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
  const hm = `${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
  return filterPublicBookableTimeSlots(config, ymd, {
    enforceLeadTime: true,
    now,
  }).includes(hm);
}

/** Frühestes wählbares Datum (`yyyy-MM-dd`) für den DatePicker. */
export function earliestBookableYmd(
  config: PublicEmbedBookingConfig,
  now = new Date(),
): string {
  const first = firstBookableEmbedSlot(config, now);
  return first?.ymd ?? restaurantTodayYmd(configTimeZone(config), now);
}

/** Erster buchbarer Slot (Öffnungszeiten, Schließ-Puffer, Vorlauf). */
export function firstBookableEmbedSlot(
  config: PublicEmbedBookingConfig,
  now = new Date(),
): { ymd: string; hm: string } | null {
  const timeZone = configTimeZone(config);
  const minAt = minimumBookingStartsAt(config.bookingLeadTimeHours, now);
  const startYmd = restaurantTodayYmd(timeZone, minAt);

  for (let i = 0; i < MAX_SLOT_SEARCH_DAYS; i++) {
    const ymd = addRestaurantCalendarDaysYmd(startYmd, i, timeZone);
    const slots = filterPublicBookableTimeSlots(config, ymd, { now });
    if (slots.length > 0) {
      return { ymd, hm: slots[0]! };
    }
  }
  return null;
}

/** Standard-Datum/Uhrzeit fürs Embed. */
export function resolveEmbedBookingDefaultYmdHm(
  config: PublicEmbedBookingConfig,
  now = new Date(),
): { ymd: string; hm: string } {
  const timeZone = configTimeZone(config);
  const preferred = defaultEmbedBookingYmdHm(timeZone, now);
  const preferredMs = ymdHmToInstant(
    preferred.ymd,
    preferred.hm,
    timeZone,
  ).getTime();
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
  return filterPublicBookableTimeSlots(config, dateYmd, { now }).includes(
    timeHm,
  );
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

export function isYmdBeforeEarliestBookable(
  dateYmd: string,
  earliestYmd: string,
): boolean {
  return dateYmd < earliestYmd;
}
