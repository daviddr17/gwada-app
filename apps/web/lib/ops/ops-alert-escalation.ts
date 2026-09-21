/** Akut (Cron-Lag, hängender Versand): kurze Wiederholung. */
export const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Unverändertes 24h-SLO (gleiche späte Anzahl, kein Cron-Lag, nichts hängend).
 * Die Quote rollt über 24 Stunden — nicht alle 10 Minuten neu mailen.
 */
export const ALERT_SLO_UNCHANGED_REPEAT_MS = 24 * 60 * 60 * 1000;

const SLO_ONLY_FINGERPRINT = /^slo\|late:\d+\|stale:\|hung:$/;

/** Nur die 24h-Quote, ohne akuten Zustellausfall. */
export function isSloOnlyFingerprint(fingerprint: string): boolean {
  return SLO_ONLY_FINGERPRINT.test(fingerprint);
}

export function alertRepeatCooldownMs(fingerprint: string): number {
  return isSloOnlyFingerprint(fingerprint)
    ? ALERT_SLO_UNCHANGED_REPEAT_MS
    : ALERT_COOLDOWN_MS;
}

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
