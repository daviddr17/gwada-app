import type { AccountingDocumentLogChange } from "@/lib/types/accounting-document-log";
import type {
  AccountingInvoiceRow,
  AccountingQuotationRow,
  AccountingVoucherRow,
} from "@/lib/types/accounting";

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("de-DE");
  } catch {
    return iso;
  }
}

function fmtMoney(amount: number | null | undefined, currency = "EUR"): string | null {
  if (amount == null || Number.isNaN(amount)) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(amount);
}

function pushChange(
  changes: AccountingDocumentLogChange[],
  field: string,
  from: string | null | undefined,
  to: string | null | undefined,
) {
  const a = from ?? null;
  const b = to ?? null;
  if (a === b) return;
  changes.push({ field, from: a, to: b });
}

export function diffSalesDocumentRow(
  before: AccountingInvoiceRow | AccountingQuotationRow,
  after: AccountingInvoiceRow | AccountingQuotationRow,
  kind: "invoice" | "quotation",
): AccountingDocumentLogChange[] {
  const changes: AccountingDocumentLogChange[] = [];
  const currency = after.currency ?? before.currency ?? "EUR";

  pushChange(changes, "Status", before.status, after.status);
  pushChange(changes, "Datum", fmtDate(before.voucher_date), fmtDate(after.voucher_date));

  if (kind === "invoice" && "due_date" in before && "due_date" in after) {
    pushChange(
      changes,
      "Fällig",
      fmtDate(before.due_date),
      fmtDate(after.due_date),
    );
  }
  if (kind === "quotation" && "expiration_date" in before && "expiration_date" in after) {
    pushChange(
      changes,
      "Gültig bis",
      fmtDate(before.expiration_date),
      fmtDate(after.expiration_date),
    );
  }

  pushChange(
    changes,
    "Empfänger",
    before.recipient_snapshot?.name ?? null,
    after.recipient_snapshot?.name ?? null,
  );
  pushChange(changes, "Preisart", before.tax_mode, after.tax_mode);
  pushChange(changes, "Währung", before.currency, after.currency);
  pushChange(
    changes,
    "Brutto",
    fmtMoney(before.totals?.totalGross, currency),
    fmtMoney(after.totals?.totalGross, currency),
  );

  const beforeCount = before.line_items?.length ?? 0;
  const afterCount = after.line_items?.length ?? 0;
  if (beforeCount !== afterCount) {
    pushChange(
      changes,
      "Positionen",
      String(beforeCount),
      String(afterCount),
    );
  }

  return changes;
}

export function diffVoucherRow(
  before: AccountingVoucherRow,
  after: AccountingVoucherRow,
): AccountingDocumentLogChange[] {
  const changes: AccountingDocumentLogChange[] = [];
  const currency = after.currency ?? before.currency ?? "EUR";

  pushChange(changes, "Status", before.status, after.status);
  pushChange(changes, "Art", before.voucher_kind, after.voucher_kind);
  pushChange(changes, "Datum", fmtDate(before.voucher_date), fmtDate(after.voucher_date));
  pushChange(changes, "Nummer", before.voucher_number, after.voucher_number);
  pushChange(changes, "Kontakt", before.contact_name, after.contact_name);
  pushChange(
    changes,
    "Brutto",
    fmtMoney(before.total_gross_amount, currency),
    fmtMoney(after.total_gross_amount, currency),
  );
  pushChange(changes, "Notiz", before.remark, after.remark);

  const beforeCount = before.voucher_items?.length ?? 0;
  const afterCount = after.voucher_items?.length ?? 0;
  if (beforeCount !== afterCount) {
    pushChange(changes, "Steuerpositionen", String(beforeCount), String(afterCount));
  }

  return changes;
}
