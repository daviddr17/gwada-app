/** Wert für `<input type="datetime-local" />` aus ISO-String (Browser-Lokalzeit). */
export function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${day}T${h}:${mi}`;
}

/** Lokaler Kalendertag → `yyyy-MM-dd` (für DatePickerField). */
export function localDayToYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Aus `datetime-local`-String `yyyy-MM-ddTHH:mm` → Datum + Uhrzeit getrennt. */
export function datetimeLocalValueToYmdHm(value: string): {
  ymd: string;
  hm: string;
} {
  if (!value || typeof value !== "string") {
    return { ymd: "", hm: "12:00" };
  }
  const [ymd, t = ""] = value.split("T");
  const hm = /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : "12:00";
  return { ymd: ymd ?? "", hm };
}

/** `yyyy-MM-dd` + `HH:mm` → Wert wie bei `<input type="datetime-local" />`. */
export function ymdAndHmToDatetimeLocal(ymd: string, hm: string): string {
  const d = ymd.trim();
  const raw = hm.trim();
  const time = /^\d{2}:\d{2}$/.test(raw) ? raw : "12:00";
  return `${d}T${time}`;
}

/** Aus `datetime-local` zurück nach ISO (UTC). */
export function datetimeLocalValueToIso(value: string): string {
  const d = new Date(value);
  return d.toISOString();
}

export function reservationDurationMs(
  startsIso: string,
  endsIso: string,
): number {
  const a = new Date(startsIso).getTime();
  const b = new Date(endsIso).getTime();
  const d = b - a;
  return Number.isFinite(d) && d > 0 ? d : 2 * 60 * 60 * 1000;
}
