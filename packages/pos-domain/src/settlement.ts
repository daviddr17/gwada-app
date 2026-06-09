/** Per-line payment chip (quantity-based split bill). */
export type PosLinePaymentState = "unpaid" | "partial" | "paid";

export type PosSessionLineInput = {
  lineTotalCents: number;
  quantity: number;
  paidQuantity: number;
};

export type PosSessionSettlementState = {
  allPaid: boolean;
  openCents: number;
  openLineCount: number;
  totalCents: number;
  paidCents: number;
};

export function deriveLinePaymentState(
  quantity: number,
  paidQuantity: number,
): PosLinePaymentState {
  const qty = Number(quantity);
  const paid = Number(paidQuantity);
  if (!Number.isFinite(qty) || qty <= 0) return "unpaid";
  if (!Number.isFinite(paid) || paid <= 0) return "unpaid";
  if (paid >= qty - 1e-9) return "paid";
  return "partial";
}

export function openLineQuantity(quantity: number, paidQuantity: number): number {
  const qty = Number(quantity);
  const paid = Number(paidQuantity);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.max(0, qty - (Number.isFinite(paid) ? paid : 0));
}

/** Integer cents for allocating `allocQty` from a line (proportional, rounded). */
export function allocationAmountCents(
  lineTotalCents: number,
  lineQuantity: number,
  allocQuantity: number,
): number {
  const total = Number(lineTotalCents);
  const qty = Number(lineQuantity);
  const alloc = Number(allocQuantity);
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (!Number.isFinite(alloc) || alloc <= 0) return 0;
  if (alloc >= qty) return Math.round(total);
  return Math.round((total * alloc) / qty);
}

export function deriveSessionSettlementState(
  lines: PosSessionLineInput[],
): PosSessionSettlementState {
  let openCents = 0;
  let paidCents = 0;
  let totalCents = 0;
  let openLineCount = 0;

  for (const line of lines) {
    const qty = Number(line.quantity);
    const paidQty = Number(line.paidQuantity);
    const lineTotal = Number(line.lineTotalCents);
    totalCents += lineTotal;

    const paidPart = allocationAmountCents(lineTotal, qty, paidQty);
    paidCents += paidPart;
    const openQty = openLineQuantity(qty, paidQty);
    if (openQty > 0) {
      openLineCount += 1;
      openCents += allocationAmountCents(lineTotal, qty, openQty);
    }
  }

  return {
    allPaid: openLineCount === 0 && lines.length > 0,
    openCents,
    openLineCount,
    totalCents,
    paidCents,
  };
}

/** Session darf geschlossen werden: keine offenen Positionen (auch bei 0 Bestellungen). */
export function canReleaseTableSession(lines: PosSessionLineInput[]): boolean {
  return deriveSessionSettlementState(lines).openLineCount === 0;
}
