"use client";

import { AccountingStatusBadge } from "@/components/accounting/accounting-status-badge";
import { Badge } from "@/components/ui/badge";
import type {
  AccountingDocumentStatusRow,
  AccountingVoucherRow,
} from "@/lib/types/accounting";
import { accountingSourceDisplayLabel } from "@/lib/accounting/accounting-source";
import { formatVoucherTaxRatesSummary } from "@/lib/accounting/voucher-display";

const KIND_LABELS: Record<string, string> = {
  expense: "Ausgabe",
  purchase: "Einkauf",
  income: "Einnahme",
  sales: "Verkauf",
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function AccountingVoucherDetailsView({
  row,
  statuses,
}: {
  row: AccountingVoucherRow;
  statuses: AccountingDocumentStatusRow[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          {KIND_LABELS[row.voucher_kind] ?? row.voucher_kind}
        </Badge>
        <AccountingStatusBadge statusCode={row.status} statuses={statuses} />
        <Badge variant="outline">
          {accountingSourceDisplayLabel(row.source)}
        </Badge>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Belegnummer</dt>
          <dd className="font-medium">{row.voucher_number ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Datum</dt>
          <dd>{new Date(row.voucher_date).toLocaleDateString("de-DE")}</dd>
        </div>
        {row.due_date ? (
          <div>
            <dt className="text-muted-foreground">Fällig</dt>
            <dd>{new Date(row.due_date).toLocaleDateString("de-DE")}</dd>
          </div>
        ) : null}
        {row.contact_name ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Kontakt</dt>
            <dd>{row.contact_name}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">Brutto</dt>
          <dd className="tabular-nums">{formatMoney(row.total_gross_amount)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Steuer</dt>
          <dd className="tabular-nums">{formatMoney(row.total_tax_amount)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Steuersätze</dt>
          <dd>{formatVoucherTaxRatesSummary(row.voucher_items)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Preisart</dt>
          <dd>{row.tax_mode === "gross" ? "Brutto" : "Netto"}</dd>
        </div>
      </dl>

      {row.remark ? (
        <p className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2 text-sm">
          {row.remark}
        </p>
      ) : null}

      {row.voucher_items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Position</th>
                <th className="px-3 py-2">Betrag</th>
                <th className="px-3 py-2">Steuer</th>
              </tr>
            </thead>
            <tbody>
              {row.voucher_items.map((item) => (
                <tr key={item.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2">{item.label}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatMoney(item.amount)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {item.taxRatePercent} % ({formatMoney(item.taxAmount)})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
