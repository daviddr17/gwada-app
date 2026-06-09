function parseYmdToLocalDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return null;
  }
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

/** Lokaler Kalendertag → UTC-ISO-Grenzen [start, end) für Supabase-Filter. */
export function localDayBoundsIso(dayYmd?: string | null): {
  start: string;
  end: string;
  day: string;
} {
  const base =
    dayYmd != null && dayYmd.trim()
      ? (parseYmdToLocalDate(dayYmd) ?? new Date())
      : new Date();
  const y = base.getFullYear();
  const m = base.getMonth();
  const d = base.getDate();
  const start = new Date(y, m, d, 0, 0, 0, 0);
  const end = new Date(y, m, d + 1, 0, 0, 0, 0);
  const day = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { start: start.toISOString(), end: end.toISOString(), day };
}

export function reservationActiveAtInstant(
  r: { starts_at: string; ends_at: string },
  instant: Date,
): boolean {
  const t = instant.getTime();
  return (
    new Date(r.starts_at).getTime() <= t &&
    new Date(r.ends_at).getTime() > t
  );
}
