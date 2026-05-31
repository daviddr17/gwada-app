export const BOOKING_TIME_STEP_OPTIONS = [1, 10, 15, 30] as const;

export type BookingTimeStepMinutes = (typeof BOOKING_TIME_STEP_OPTIONS)[number];

export const BOOKING_TIME_STEP_LABELS: Record<BookingTimeStepMinutes, string> = {
  1: "Jede Minute",
  10: "Alle 10 Minuten",
  15: "Alle 15 Minuten",
  30: "Alle 30 Minuten",
};

export function normalizeBookingTimeStepMinutes(
  value: unknown,
): BookingTimeStepMinutes {
  const n = Number(value);
  if (n === 1 || n === 10 || n === 15 || n === 30) return n;
  return 15;
}

export function snapMinutesToBookingStep(
  minutes: number,
  step: BookingTimeStepMinutes,
): number {
  if (step === 1) return Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const snapped = Math.round(minutes / step) * step;
  return Math.max(0, Math.min(24 * 60 - 1, snapped));
}
