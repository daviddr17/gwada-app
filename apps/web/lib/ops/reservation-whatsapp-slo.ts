export const CONFIRM_SLO_MS = 30_000;
export const CONFIRM_SLO_RATIO = 0.99;
export const CONFIRM_SLO_MIN_SAMPLE = 5;
/** Alte Demo-/Disconnect-Leichen sollen das On-Call nicht 14 Tage rot halten. */
export const CONFIRM_SLO_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export type ConfirmSloRow = {
  message_kind: string;
  send_at: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  created_at?: string | null;
  restaurant_id?: string | null;
};

export type ConfirmSloOptions = {
  lookbackMs?: number;
  /** Bestätigungen dieser Restaurants zählen nicht (kein WAHA / Demo). */
  includeRestaurantIds?: ReadonlySet<string> | null;
};

export type ConfirmSloResult = {
  sample: number;
  onTime: number;
  late: number;
  pending: number;
  ratio: number;
  breached: boolean;
  targetMs: number;
  targetRatio: number;
};

export function isConfirmOutboxKind(kind: string): boolean {
  return kind === "confirmed" || kind === "received";
}

function latencyMs(row: ConfirmSloRow): number | null {
  if (!row.sent_at) return null;
  const sent = Date.parse(row.sent_at);
  const start = Date.parse(row.created_at || row.send_at || "");
  if (!Number.isFinite(sent) || !Number.isFinite(start)) return null;
  return sent - start;
}

export function computeConfirmSlo(
  rows: readonly ConfirmSloRow[],
  nowMs = Date.now(),
  options?: ConfirmSloOptions,
): ConfirmSloResult {
  let sample = 0;
  let onTime = 0;
  let late = 0;
  let pending = 0;
  const lookbackMs = options?.lookbackMs ?? CONFIRM_SLO_LOOKBACK_MS;
  const includeRestaurantIds = options?.includeRestaurantIds;

  for (const row of rows) {
    if (!isConfirmOutboxKind(row.message_kind)) continue;
    if (row.cancelled_at) continue;
    if (
      includeRestaurantIds &&
      (!row.restaurant_id || !includeRestaurantIds.has(row.restaurant_id))
    ) {
      continue;
    }

    const start = Date.parse(row.created_at || row.send_at || "");
    if (!Number.isFinite(start)) continue;
    if (nowMs - start > lookbackMs) continue;

    if (row.sent_at) {
      sample += 1;
      const latency = latencyMs(row);
      if (latency != null && latency <= CONFIRM_SLO_MS) onTime += 1;
      else late += 1;
      continue;
    }

    if (nowMs - start > CONFIRM_SLO_MS) {
      sample += 1;
      late += 1;
      pending += 1;
    }
  }

  const ratio = sample === 0 ? 1 : onTime / sample;
  return {
    sample,
    onTime,
    late,
    pending,
    ratio,
    breached: sample >= CONFIRM_SLO_MIN_SAMPLE && ratio < CONFIRM_SLO_RATIO,
    targetMs: CONFIRM_SLO_MS,
    targetRatio: CONFIRM_SLO_RATIO,
  };
}
