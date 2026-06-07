/** Kitchen / POS order lifecycle (Gwada Staff). */
export const POS_ORDER_STATUSES = [
  "pending_payment",
  "received",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
] as const;

export type PosOrderStatus = (typeof POS_ORDER_STATUSES)[number];

export const POS_PAYMENT_STATUSES = ["open", "paid", "failed", "refunded"] as const;
export type PosPaymentStatus = (typeof POS_PAYMENT_STATUSES)[number];

export const POS_PAYMENT_METHODS = ["cash", "card", "paypal", "terminal"] as const;
export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

export type PosPaymentState = "unpaid" | "partial" | "paid";

const TERMINAL_STATUSES = new Set<PosOrderStatus>(["delivered", "cancelled"]);

const ALLOWED_TRANSITIONS: Readonly<Record<PosOrderStatus, readonly PosOrderStatus[]>> = {
  pending_payment: ["received", "cancelled"],
  received: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransitionPosOrderStatus(
  from: PosOrderStatus,
  to: PosOrderStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertPosOrderStatusTransition(
  from: PosOrderStatus,
  to: PosOrderStatus,
): void {
  if (!canTransitionPosOrderStatus(from, to)) {
    throw new Error(`Invalid order status transition: ${from} → ${to}`);
  }
}

export function isPosOrderTerminal(status: PosOrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Derive UI payment chip from paid vs order total (integer cents). */
export function derivePosPaymentState(
  orderTotalCents: number,
  paidTotalCents: number,
): PosPaymentState {
  if (paidTotalCents <= 0) return "unpaid";
  if (paidTotalCents >= orderTotalCents) return "paid";
  return "partial";
}
