import {
  hhmmToMinutes,
  minutesToHHmm,
} from "@/lib/reservations/day-opening-slots";
import {
  snapMinutesToBookingStep,
  type BookingTimeStepMinutes,
} from "@/lib/reservations/booking-time-step";
import { ymdHmToRestaurantIso } from "@/lib/restaurant/restaurant-timezone";

export function snapDisplayReservationTimeHm(
  hm: string,
  step: BookingTimeStepMinutes,
): string {
  return minutesToHHmm(
    snapMinutesToBookingStep(hhmmToMinutes(hm), step),
  );
}

export function resolveDisplayReservationDwellMinutes(
  dwellDraft: string,
  defaultDwellMinutes: number,
): number | null {
  const dwellTrim = dwellDraft.trim();
  if (dwellTrim === "") {
    return Number.isFinite(defaultDwellMinutes) && defaultDwellMinutes >= 15
      ? defaultDwellMinutes
      : 120;
  }
  const n = Number.parseInt(dwellTrim, 10);
  if (!Number.isFinite(n) || n < 15 || n > 1440) return null;
  return n;
}

export function buildDisplayReservationSlotIso(
  dateYmd: string,
  timeHm: string,
  dwellMinutes: number,
  timeZone: string,
  step: BookingTimeStepMinutes,
): { startsIso: string; endsIso: string; snappedTime: string } | null {
  const snappedTime = snapDisplayReservationTimeHm(timeHm, step);
  let startsIso: string;
  try {
    startsIso = ymdHmToRestaurantIso(dateYmd, snappedTime, timeZone);
  } catch {
    return null;
  }
  const startMs = new Date(startsIso).getTime();
  if (Number.isNaN(startMs)) return null;
  const endMs = startMs + dwellMinutes * 60 * 1000;
  if (!Number.isFinite(endMs) || endMs <= startMs) return null;
  return {
    startsIso,
    endsIso: new Date(endMs).toISOString(),
    snappedTime,
  };
}

export function isValidReservationTimeRange(
  startsAt: string,
  endsAt: string,
): boolean {
  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();
  return (
    Number.isFinite(startMs) &&
    Number.isFinite(endMs) &&
    endMs > startMs
  );
}
