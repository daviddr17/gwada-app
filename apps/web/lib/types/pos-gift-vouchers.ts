export type PosGiftVoucherStatus =
  | "active"
  | "redeemed"
  | "voided"
  | "expired";

export type PosGiftVoucherPrintFormat = "a4" | "thermal" | "both";

export type PosGiftVoucherSettings = {
  restaurant_id: string;
  default_validity_months: number;
  voucher_printer_id: string | null;
  print_format: PosGiftVoucherPrintFormat;
};

export type PosGiftVoucherRow = {
  id: string;
  restaurant_id: string;
  code: string;
  public_token: string;
  initial_amount_cents: number;
  balance_cents: number;
  currency: string;
  status: PosGiftVoucherStatus;
  validity_months_at_issue: number;
  issued_at: string;
  expires_at: string;
  voided_at: string | null;
  expired_at: string | null;
  issued_by_profile_id: string | null;
  voided_by_profile_id: string | null;
  issue_payment_method: string;
  issue_order_id: string | null;
  issue_payment_id: string | null;
  issue_cash_entry_id: string | null;
  void_cash_entry_id: string | null;
  expire_accounting_voucher_id: string | null;
  last_printed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type PosGiftVoucherEventType =
  | "issued"
  | "redeemed"
  | "voided"
  | "expired"
  | "reprinted";

export type PosGiftVoucherEventRow = {
  id: string;
  restaurant_id: string;
  gift_voucher_id: string;
  event_type: PosGiftVoucherEventType;
  amount_cents: number;
  balance_after_cents: number;
  pos_payment_id: string | null;
  cash_entry_id: string | null;
  accounting_voucher_id: string | null;
  actor_profile_id: string | null;
  note: string | null;
  created_at: string;
};

export type PosGiftVoucherListStats = {
  activeCount: number;
  activeBalanceCents: number;
  redeemedCount: number;
  voidedCount: number;
  expiredCount: number;
  issuedCentsInPeriod: number;
  redeemedCentsInPeriod: number;
};

/** QR-/Scan-Payload-Präfix (danach public_token). */
export const POS_GIFT_VOUCHER_QR_PREFIX = "GWADA-GV:";

export function buildPosGiftVoucherQrPayload(publicToken: string): string {
  return `${POS_GIFT_VOUCHER_QR_PREFIX}${publicToken.trim()}`;
}

export function parsePosGiftVoucherQrPayload(
  raw: string,
): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith(POS_GIFT_VOUCHER_QR_PREFIX)) {
    const token = value.slice(POS_GIFT_VOUCHER_QR_PREFIX.length).trim();
    return token || null;
  }
  // Fallback: nackter Token / Code
  if (/^[A-Za-z0-9_-]{8,64}$/.test(value)) return value;
  if (/^GV-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(value)) return value.toUpperCase();
  return null;
}
