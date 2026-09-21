/**
 * Ob eine Reservierungs-WhatsApp wirklich rausgegangen ist — und ob Retry sicher ist.
 *
 * WAHA kann `/api/sendText` abbrechen, obwohl Noweb die Nachricht schon angenommen hat.
 * Dann gilt: erst belegen (Inbox-Zeile oder Chat-Historie), dann retryen.
 */

export const WAHA_IMMEDIATE_RETRY_WINDOW_MS = 45 * 60 * 1000;
/** Kurz warten, bis Webhook/Historie nachziehen, bevor wir erneut senden. */
export const WAHA_RECONCILE_GRACE_MS = 90 * 1000;
/** Ohne Beleg nicht retryen — Doppelversand ist schlimmer als ein verpasster Send. */
export const WAHA_UNKNOWN_HOLD_MS = 10 * 60 * 1000;

export const WAHA_SEND_TIMEOUT_RE =
  /aborted due to timeout|TimeoutError|signal timed out/i;

export type WahaOutboundEvidenceStatus = "confirmed" | "absent" | "unknown";

export type WahaOutboundEvidence = {
  status: WahaOutboundEvidenceStatus;
  wahaMessageId?: string;
  source?: "contact_messages" | "waha_history";
  reason?: string;
};

export type WhatsappRetryDecision =
  | "already_sent"
  | "retry_now"
  | "wait"
  | "give_up";

export function isWahaSendTimeoutError(error: string): boolean {
  return WAHA_SEND_TIMEOUT_RE.test(error);
}

export function outboundTextMatchesWahaBody(
  stored: string,
  incoming: string,
): boolean {
  const a = stored.replace(/\s+/g, " ").trim();
  const b = incoming.replace(/\s+/g, " ").trim();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function wahaChatMessageTimestampMs(
  timestamp: number | undefined,
): number | null {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  // WAHA liefert oft Unix-Sekunden.
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

export function findMatchingFromMeWahaMessage(
  messages: ReadonlyArray<{
    id?: string;
    fromMe?: boolean;
    body?: string | null;
    timestamp?: number;
  }>,
  body: string,
  sinceMs: number,
): { id: string } | null {
  const slackMs = 60_000;
  for (const msg of messages) {
    if (msg.fromMe !== true) continue;
    const id = typeof msg.id === "string" ? msg.id.trim() : "";
    if (!id) continue;
    if (!outboundTextMatchesWahaBody(body, msg.body ?? "")) continue;
    const at = wahaChatMessageTimestampMs(msg.timestamp);
    if (at != null && at < sinceMs - slackMs) continue;
    return { id };
  }
  return null;
}

/**
 * @param firstSendAtMs Erster Versuch (`send_at` / Claim).
 * @param claimedAtMs Aktueller In-Flight-Lock, sonst null.
 */
export function decideWhatsappRetry(input: {
  evidence: WahaOutboundEvidenceStatus;
  firstSendAtMs: number;
  claimedAtMs: number | null;
  nowMs?: number;
}): WhatsappRetryDecision {
  if (input.evidence === "confirmed") return "already_sent";

  const nowMs = input.nowMs ?? Date.now();
  const age = nowMs - input.firstSendAtMs;
  if (!Number.isFinite(input.firstSendAtMs) || age > WAHA_IMMEDIATE_RETRY_WINDOW_MS) {
    return "give_up";
  }

  const claimedAge =
    input.claimedAtMs == null ? Number.POSITIVE_INFINITY : nowMs - input.claimedAtMs;

  if (input.evidence === "absent") {
    if (claimedAge < WAHA_RECONCILE_GRACE_MS) return "wait";
    return "retry_now";
  }

  if (claimedAge < WAHA_UNKNOWN_HOLD_MS) return "wait";
  return "give_up";
}
