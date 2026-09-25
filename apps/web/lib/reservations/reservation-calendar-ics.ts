/** Kalenderdatei einer bestätigten Reservierung (iCalendar, METHOD:REQUEST). */

export const RESERVATION_CALENDAR_METHOD = "REQUEST" as const;

const PRODID = "-//Gwada//Reservierung//DE";
const UID_DOMAIN = "gwada.app";
const FALLBACK_TIMEZONE = "Europe/Berlin";
const FALLBACK_ORGANIZER = "reservierung@gwada.app";

const EUROPE_BERLIN_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "X-LIC-LOCATION:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

export type ReservationCalendarFacts = {
  startsAt: string;
  endsAt: string;
  partySize: number;
  diningTableId: string | null;
  /** Adresse und Tischname — ändert sich der Ort, steigt SEQUENCE. */
  location: string;
};

export type ReservationCalendarInput = {
  reservationId: string;
  reservationNumber: number;
  sequence: number;
  timeZone: string;
  startsAt: Date;
  endsAt: Date;
  partySize: number;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string | null;
  restaurantName: string;
  restaurantEmail: string | null;
  location: string;
  now?: Date;
};

export function reservationCalendarUid(reservationId: string): string {
  return `reservation-${reservationId}@${UID_DOMAIN}`;
}

export function reservationCalendarFilename(reservationNumber: number): string {
  const n = Number.isFinite(reservationNumber)
    ? Math.max(0, Math.trunc(reservationNumber))
    : 0;
  return `Reservierung-${n}.ics`;
}

export function reservationCalendarContentType(): string {
  return `text/calendar; method=${RESERVATION_CALENDAR_METHOD}; charset=UTF-8`;
}

function instantKey(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? iso.trim() : String(ms);
}

export function reservationCalendarFingerprint(
  facts: ReservationCalendarFacts,
): string {
  const party = Number.isFinite(facts.partySize)
    ? Math.max(0, Math.trunc(facts.partySize))
    : 0;
  return [
    instantKey(facts.startsAt),
    instantKey(facts.endsAt),
    String(party),
    facts.diningTableId?.trim() ?? "",
    facts.location.trim(),
  ].join("|");
}

export function reservationCalendarFactsChanged(
  before: {
    starts_at: string;
    ends_at: string;
    party_size: number;
    dining_table_id: string | null;
  },
  after: {
    starts_at: string;
    ends_at: string;
    party_size: number;
    dining_table_id: string | null;
  },
): boolean {
  const fp = (
    row: {
      starts_at: string;
      ends_at: string;
      party_size: number;
      dining_table_id: string | null;
    },
  ) =>
    reservationCalendarFingerprint({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      partySize: row.party_size,
      diningTableId: row.dining_table_id,
      location: "",
    });
  return fp(before) !== fp(after);
}

export function resolveReservationCalendarTimeZone(
  timeZone: string | null | undefined,
): string {
  const value = timeZone?.trim() || FALLBACK_TIMEZONE;
  try {
    Intl.DateTimeFormat("en-GB", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line: string): string {
  const max = 73;
  if (line.length <= max) return line;
  const parts = [line.slice(0, max)];
  let i = max;
  while (i < line.length) {
    parts.push(` ${line.slice(i, i + max - 1)}`);
    i += max - 1;
  }
  return parts.join("\r\n");
}

function formatIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function zonedParts(
  date: Date,
  timeZone: string,
): { year: string; month: string; day: string; hour: string; minute: string; second: string } {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  let hour = parts.hour ?? "00";
  if (hour === "24") hour = "00";
  return {
    year: parts.year ?? "1970",
    month: parts.month ?? "01",
    day: parts.day ?? "01",
    hour,
    minute: parts.minute ?? "00",
    second: parts.second ?? "00",
  };
}

function formatIcsLocal(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}`;
}

function offsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}${mm}`;
}

function vtimezoneBlock(timeZone: string, at: Date): string {
  if (timeZone === "Europe/Berlin") return EUROPE_BERLIN_VTIMEZONE;
  const offset = formatOffset(offsetMinutes(at, timeZone));
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${timeZone}`,
    "BEGIN:STANDARD",
    `TZOFFSETFROM:${offset}`,
    `TZOFFSETTO:${offset}`,
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
  ].join("\r\n");
}

function formatSlotDe(date: Date, timeZone: string): { date: string; time: string } {
  const dateLabel = new Intl.DateTimeFormat("de-DE", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
  const p = zonedParts(date, timeZone);
  return { date: dateLabel, time: `${p.hour}:${p.minute}` };
}

function organizerMailto(email: string | null | undefined): string {
  const value = email?.trim() ?? "";
  if (value.includes("@") && !value.includes(" ") && !value.includes("\n")) {
    return value;
  }
  return FALLBACK_ORGANIZER;
}

function guestMailto(email: string | null | undefined): string | null {
  const value = email?.trim() ?? "";
  if (!value.includes("@") || value.includes(" ") || value.includes("\n")) {
    return null;
  }
  return value;
}

export function buildReservationCalendarIcs(input: ReservationCalendarInput): string {
  const timeZone = resolveReservationCalendarTimeZone(input.timeZone);
  const starts = input.startsAt;
  const ends =
    input.endsAt.getTime() > starts.getTime()
      ? input.endsAt
      : new Date(starts.getTime() + 60 * 60 * 1000);
  const sequence = Number.isFinite(input.sequence)
    ? Math.max(0, Math.trunc(input.sequence))
    : 0;
  const restaurant = input.restaurantName.trim() || "Restaurant";
  const guest = `${input.guestFirstName} ${input.guestLastName}`.trim() || "Gast";
  const party = Number.isFinite(input.partySize)
    ? Math.max(1, Math.trunc(input.partySize))
    : 1;
  const location = input.location.trim() || restaurant;
  const startLabel = formatSlotDe(starts, timeZone);
  const endLabel = formatSlotDe(ends, timeZone);
  const description = [
    `Restaurant: ${restaurant}`,
    `Gast: ${guest}`,
    `Personen: ${party}`,
    `Datum: ${startLabel.date}`,
    `Uhrzeit: ${startLabel.time}–${endLabel.time}`,
    `Adresse: ${location}`,
    `Reservierung: #${Math.max(0, Math.trunc(input.reservationNumber) || 0)}`,
  ].join("\n");
  const summary = `Reservierung bei ${restaurant} (${party} ${party === 1 ? "Person" : "Personen"})`;
  const organizer = organizerMailto(input.restaurantEmail);
  const attendee = guestMailto(input.guestEmail);
  const lines = [
    "BEGIN:VCALENDAR",
    `PRODID:${PRODID}`,
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${RESERVATION_CALENDAR_METHOD}`,
    ...vtimezoneBlock(timeZone, starts).split("\r\n"),
    "BEGIN:VEVENT",
    `UID:${reservationCalendarUid(input.reservationId)}`,
    `DTSTAMP:${formatIcsUtc(input.now ?? new Date())}`,
    `DTSTART;TZID=${timeZone}:${formatIcsLocal(starts, timeZone)}`,
    `DTEND;TZID=${timeZone}:${formatIcsLocal(ends, timeZone)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `LOCATION:${icsEscape(location)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    "STATUS:CONFIRMED",
    `SEQUENCE:${sequence}`,
    `ORGANIZER;CN=${icsEscape(restaurant)}:mailto:${organizer}`,
  ];
  if (attendee) {
    lines.push(
      `ATTENDEE;CN=${icsEscape(guest)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee}`,
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
