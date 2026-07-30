/**
 * Glocke / Push: nur Bewertungen in diesem Fenster (wie DB-Trigger max_age).
 * Ältere Cache-Zeilen gelten nicht als „neue“ Benachrichtigung.
 */
export const REVIEW_NOTIFICATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isReviewInNotificationWindow(
  createdAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!createdAt?.trim()) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= nowMs - REVIEW_NOTIFICATION_MAX_AGE_MS;
}
