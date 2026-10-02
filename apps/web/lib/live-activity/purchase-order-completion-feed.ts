export type PurchaseOrderCompletionExceptionStatus = "partial" | "not_delivered";

export type PurchaseOrderCompletionException = {
  ingredientName: string;
  status: PurchaseOrderCompletionExceptionStatus;
  orderedQuantity: number;
  deliveredQuantity: number;
  unitLabel: string;
  note: string | null;
};

export type PurchaseOrderCompletionCounts = {
  orderedCount: number;
  deliveredCount: number;
  shortCount: number;
  missingCount: number;
};

export type PurchaseOrderCompletionFeed = PurchaseOrderCompletionCounts & {
  orderId: string;
  exceptions: PurchaseOrderCompletionException[];
};

function pickNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatQty(qty: number): string {
  if (Number.isInteger(qty)) return String(qty);
  return String(qty).replace(".", ",");
}

/** Untertitel der einen Abschluss-Zeile. Null-Eimer fallen weg. */
export function formatPurchaseOrderCompletionSubtitle(
  counts: PurchaseOrderCompletionCounts,
): string | null {
  const total = counts.orderedCount;
  if (!Number.isFinite(total) || total <= 0) return null;
  const parts: string[] = [];
  if (counts.deliveredCount > 0) {
    parts.push(`${counts.deliveredCount}/${total} geliefert`);
  }
  if (counts.shortCount > 0) {
    parts.push(`${counts.shortCount}/${total} Fehlmenge`);
  }
  if (counts.missingCount > 0) {
    parts.push(`${counts.missingCount}/${total} nicht geliefert`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function purchaseOrderCompletionFromPayload(
  payload: Record<string, unknown>,
): PurchaseOrderCompletionFeed | null {
  if (pickString(payload.kind) !== "order_completed") return null;
  const orderId = pickString(payload.orderId);
  const orderedCount = pickNumber(payload.orderedCount);
  if (!orderId || orderedCount == null) return null;

  const exceptions: PurchaseOrderCompletionException[] = [];
  if (Array.isArray(payload.exceptions)) {
    for (const raw of payload.exceptions) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const status = pickString(row.status);
      if (status !== "partial" && status !== "not_delivered") continue;
      const ingredientName = pickString(row.ingredientName);
      const orderedQuantity = pickNumber(row.orderedQuantity);
      if (!ingredientName || orderedQuantity == null) continue;
      exceptions.push({
        ingredientName,
        status,
        orderedQuantity,
        deliveredQuantity: pickNumber(row.deliveredQuantity) ?? 0,
        unitLabel: pickString(row.unitLabel) ?? "",
        note: pickString(row.note),
      });
    }
  }

  return {
    orderId,
    orderedCount,
    deliveredCount: pickNumber(payload.deliveredCount) ?? 0,
    shortCount: pickNumber(payload.shortCount) ?? 0,
    missingCount: pickNumber(payload.missingCount) ?? 0,
    exceptions,
  };
}

export function formatPurchaseOrderCompletionExceptionDetail(
  line: PurchaseOrderCompletionException,
): string {
  const unit = line.unitLabel.trim();
  const ordered = formatQty(line.orderedQuantity);
  const delivered = formatQty(line.deliveredQuantity);
  const withUnit = (qty: string) => (unit ? `${qty} ${unit}` : qty);
  const note = line.note ? ` · ${line.note}` : "";
  if (line.status === "not_delivered") {
    return `nicht geliefert · ${withUnit(ordered)} bestellt${note}`;
  }
  return `Fehlmenge · ${withUnit(delivered)} von ${withUnit(ordered)}${note}`;
}
