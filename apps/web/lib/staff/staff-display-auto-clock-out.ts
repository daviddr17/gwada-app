/** Grenzen für Display Auto-Abmeldung (Mitarbeiter-Einstellungen). */
export const DISPLAY_AUTO_CLOCK_OUT_HOURS_MIN = 1;
export const DISPLAY_AUTO_CLOCK_OUT_HOURS_MAX = 48;
export const DISPLAY_AUTO_CLOCK_OUT_HOURS_DEFAULT = 12;

export type StaffDisplayAutoClockOutPolicy = {
  /** Standard: an (12h) — vergessene Display-Stempel still schließen. */
  enabled: boolean;
  hours: number;
};

export function normalizeDisplayAutoClockOutHours(raw: unknown): number {
  if (
    typeof raw === "number" &&
    Number.isFinite(raw) &&
    raw >= DISPLAY_AUTO_CLOCK_OUT_HOURS_MIN &&
    raw <= DISPLAY_AUTO_CLOCK_OUT_HOURS_MAX
  ) {
    return Math.round(raw);
  }
  return DISPLAY_AUTO_CLOCK_OUT_HOURS_DEFAULT;
}

/** Offenes Display-Segment länger als konfigurierte Stunden → Auto-Abmeldung fällig. */
export function isDisplayAutoClockOutDue(
  open: { starts_at: string },
  policy: StaffDisplayAutoClockOutPolicy,
  now: Date = new Date(),
): boolean {
  if (!policy.enabled) return false;
  const hours = normalizeDisplayAutoClockOutHours(policy.hours);
  const started = new Date(open.starts_at);
  if (Number.isNaN(started.getTime())) return false;
  return now.getTime() - started.getTime() >= hours * 60 * 60 * 1000;
}
