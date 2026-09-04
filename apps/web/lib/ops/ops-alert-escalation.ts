/** Wiederholung, solange ungesund — nicht 30 Min Stille. */
export const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

const COUNT_SUFFIX = /^(.*)::n=(\d+)$/;

export function encodeAlertFingerprint(base: string, count: number): string {
  return `${base}::n=${Math.max(1, count)}`;
}

export function parseAlertFingerprintState(
  stored: string | null,
  current: string,
): { sameIssue: boolean; previousCount: number; nextCount: number } {
  if (!stored) {
    return { sameIssue: false, previousCount: 0, nextCount: 1 };
  }
  const match = stored.match(COUNT_SUFFIX);
  const base = match?.[1] ?? stored;
  const previousCount = match ? Number(match[2]) : 1;
  if (base !== current) {
    return { sameIssue: false, previousCount: 0, nextCount: 1 };
  }
  return {
    sameIssue: true,
    previousCount: Number.isFinite(previousCount) ? previousCount : 1,
    nextCount: (Number.isFinite(previousCount) ? previousCount : 1) + 1,
  };
}

export function opsAlertSubject(params: {
  sloBreached: boolean;
  escalationCount: number;
}): string {
  const base = params.sloBreached
    ? "Gwada On-Call: WhatsApp-Bestätigungen unter SLO"
    : "Gwada On-Call: Zustellung/Cron auffällig";
  if (params.escalationCount >= 2) {
    return `ESKALATION ${params.escalationCount}x — ${base}`;
  }
  return base;
}
