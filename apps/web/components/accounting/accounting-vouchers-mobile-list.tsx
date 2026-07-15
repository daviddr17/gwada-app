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
  AccountingVoucherRow,
} from "@/lib/types/accounting";

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

export type AccountingVouchersMobileListProps = {
  rows: AccountingVoucherRow[];
  emptyLabel: string;
  statuses: AccountingDocumentStatusRow[];
  canManage: boolean;
  onOpenRow: (row: AccountingVoucherRow) => void;
  onEditRow: (row: AccountingVoucherRow) => void;
};

/** Mobile-only: Belege als Karten ohne Quer-Scroll. */
export function AccountingVouchersMobileList({
  rows,
  emptyLabel,
  statuses,
  canManage,
  onOpenRow,
  onEditRow,
}: AccountingVouchersMobileListProps) {
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
        const contact = row.contact_name ?? "—";
        const kindLabel = KIND_LABELS[row.voucher_kind] ?? row.voucher_kind;
        const isCorrection = isAccountingCorrectionVariant(row.document_variant);
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
                aria-label={`${row.voucher_number ?? contact} öffnen`}
              >
                <p className="inline-flex max-w-full flex-wrap items-center gap-1.5 text-base font-semibold leading-snug">
                  <span className="truncate">{row.voucher_number ?? "—"}</span>
                  {isCorrection ? (
                    <Badge variant="secondary" className="text-xs">
                      Korrektur
                    </Badge>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {contact}
                  <span aria-hidden> · </span>
                  {kindLabel}
                  <span aria-hidden> · </span>
                  <span className="tabular-nums">
                    {new Date(row.voucher_date).toLocaleDateString("de-DE")}
                  </span>
                </p>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatMoney(row.total_gross_amount)}
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
            {external || canManage ? (
              <div className="mt-3 flex justify-end border-t border-border/40 pt-3">
                {external ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={external}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
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
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
