"use client";

import { ExternalLink } from "lucide-react";
import { AccountingSourceIcon } from "@/components/accounting/accounting-source-icon";
import { AccountingStatusBadge } from "@/components/accounting/accounting-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  accountingSourceDisplayLabel,
  isExternalAccountingSource,
} from "@/lib/accounting/accounting-source";
import { isAccountingCorrectionVariant } from "@/lib/accounting/accounting-corrections";
import type {
  AccountingDocumentStatusRow,
  AccountingInvoiceRow,
  AccountingQuotationRow,
} from "@/lib/types/accounting";

type SalesDocumentRow = AccountingInvoiceRow | AccountingQuotationRow;

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(amount);
}

export type AccountingSalesDocumentsMobileListProps = {
  rows: SalesDocumentRow[];
  emptyLabel: string;
  statuses: AccountingDocumentStatusRow[];
  onOpenRow: (row: SalesDocumentRow) => void;
  onEditRow: (row: SalesDocumentRow) => void;
};

/** Mobile-only: Rechnungen/Angebote als Karten ohne Quer-Scroll. */
export function AccountingSalesDocumentsMobileList({
  rows,
  emptyLabel,
  statuses,
  onOpenRow,
  onEditRow,
}: AccountingSalesDocumentsMobileListProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border/50 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const recipient = row.recipient_snapshot?.name ?? "—";
        const isCorrection =
          isAccountingCorrectionVariant(row.document_variant) ||
          row.external_document_type === "credit_note";
        const external =
          isExternalAccountingSource(row.source) && row.external_edit_url
            ? row.external_edit_url
            : null;

        return (
          <li
            key={row.id}
            className="rounded-2xl border border-border/50 bg-card p-4 shadow-card"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                <AccountingSourceIcon source={row.source} />
              </div>
              <button
                type="button"
                className="min-w-0 flex-1 rounded-xl text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
                onClick={() => onOpenRow(row)}
                aria-label={`${recipient} öffnen`}
              >
                <p className="truncate text-base font-semibold leading-snug">
                  {recipient}
                </p>
                <p className="mt-0.5 inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {row.voucher_number ?? "—"}
                  </span>
                  {isCorrection ? (
                    <Badge variant="secondary" className="text-xs">
                      Korrektur
                    </Badge>
                  ) : null}
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">
                    {new Date(row.voucher_date).toLocaleDateString("de-DE")}
                  </span>
                </p>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatMoney(row.totals?.totalGross ?? 0, row.currency)}
                  </p>
                  <AccountingStatusBadge
                    statusCode={row.status}
                    statuses={statuses}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tippen für Details
                </p>
              </button>
            </div>
            <div className="mt-3 flex justify-end border-t border-border/40 pt-3">
              {external ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  render={
                    <a href={external} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <ExternalLink className="size-4" />
                  In {accountingSourceDisplayLabel(row.source)}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEditRow(row)}
                >
                  Bearbeiten
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
