const DEMO_NOTE_PREFIX = "display-demo:";

export const RESERVATION_INTERNAL_NOTE_MAX_LENGTH = 5000;

export function normalizeReservationInternalNote(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, RESERVATION_INTERNAL_NOTE_MAX_LENGTH);
}

export function isVisibleReservationInternalNote(
  notes: string | null | undefined,
): boolean {
  const text = notes?.trim();
  if (!text) return false;
  return !text.startsWith(DEMO_NOTE_PREFIX);
}

export function reservationInternalNoteText(
  notes: string | null | undefined,
): string | null {
  return isVisibleReservationInternalNote(notes) ? notes!.trim() : null;
}
