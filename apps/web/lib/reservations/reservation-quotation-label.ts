import type { AccountingQuotationRow } from "@/lib/types/accounting";

export function formatReservationQuotationOptionLabel(
  q: Pick<
    AccountingQuotationRow,
    "voucher_number" | "recipient_snapshot" | "totals" | "currency" | "status"
  >,
  statusLabel?: string | null,
): string {
  const num = q.voucher_number?.trim() || "Angebot";
  const name = q.recipient_snapshot?.name?.trim() || "Ohne Empfänger";
  const currency = (q.currency || "EUR").toUpperCase();
  const amount = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(Number(q.totals?.totalGross) || 0);
  const status = statusLabel?.trim();
  return status
    ? `${num} · ${name} · ${amount} · ${status}`
    : `${num} · ${name} · ${amount}`;
}

export type ReservationQuotationJoin = {
  id: string;
  voucher_number: string | null;
  recipient_name: string | null;
  total_gross: number | null;
  currency: string | null;
  status: string | null;
  voucher_date: string | null;
};

export function mapReservationQuotationJoin(
  raw: unknown,
): ReservationQuotationJoin | null {
  if (!raw || typeof raw !== "object") return null;
  const o = Array.isArray(raw) ? raw[0] : raw;
  if (!o || typeof o !== "object") return null;
  const row = o as Record<string, unknown>;
  if (typeof row.id !== "string") return null;
  const snap = row.recipient_snapshot;
  const snapObj =
    snap && typeof snap === "object" && !Array.isArray(snap)
      ? (snap as Record<string, unknown>)
      : null;
  const totals = row.totals;
  const totalsObj =
    totals && typeof totals === "object" && !Array.isArray(totals)
      ? (totals as Record<string, unknown>)
      : null;
  return {
    id: row.id,
    voucher_number:
      typeof row.voucher_number === "string" ? row.voucher_number : null,
    recipient_name:
      typeof snapObj?.name === "string" ? snapObj.name : null,
    total_gross:
      typeof totalsObj?.totalGross === "number"
        ? totalsObj.totalGross
        : typeof totalsObj?.totalGross === "string"
          ? Number(totalsObj.totalGross)
          : null,
    currency: typeof row.currency === "string" ? row.currency : null,
    status: typeof row.status === "string" ? row.status : null,
    voucher_date:
      typeof row.voucher_date === "string" ? row.voucher_date : null,
  };
}

export function formatReservationQuotationJoinLabel(
  q: ReservationQuotationJoin | null | undefined,
): string {
  if (!q) return "";
  const num = q.voucher_number?.trim() || "Angebot";
  const name = q.recipient_name?.trim();
  return name ? `${num} · ${name}` : num;
}
