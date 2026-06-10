"use client";

import { ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { accountingVoucherFileUrl } from "@/lib/accounting/accounting-api";
import type { AccountingVoucherRow } from "@/lib/types/accounting";

const KIND_LABELS: Record<string, string> = {
  expense: "Ausgabe",
  purchase: "Einkauf",
  income: "Einnahme",
  sales: "Verkauf",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  open: "Offen",
  unchecked: "Ungeprüft",
  paid: "Bezahlt",
  voided: "Storniert",
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

type AccountingVoucherSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  row: AccountingVoucherRow | null;
  canManage: boolean;
  onEdit: () => void;
};

export function AccountingVoucherSheet({
  open,
  onOpenChange,
  restaurantId,
  row,
  canManage,
  onEdit,
}: AccountingVoucherSheetProps) {
  if (!row) return null;

  const hasFile =
    Boolean(row.storage_path) ||
    (row.source === "lexoffice" && row.external_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-left">
            {row.voucher_number ?? "Beleg ohne Nummer"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 px-1 pb-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{KIND_LABELS[row.voucher_kind] ?? row.voucher_kind}</Badge>
            <Badge variant="outline">{STATUS_LABELS[row.status] ?? row.status}</Badge>
            <Badge variant="outline">
              {row.source === "lexoffice" ? "Lexware" : "Gwada"}
            </Badge>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
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
          </dl>

          {row.remark ? (
            <p className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2 text-sm">
              {row.remark}
            </p>
          ) : null}

          {row.voucher_items.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full min-w-[420px] text-sm">
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

          <div className="flex flex-wrap gap-2">
            {hasFile ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                render={
                  <a
                    href={accountingVoucherFileUrl(restaurantId, row.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <FileText className="size-4" />
                Anhang öffnen
              </Button>
            ) : null}
            {row.source === "lexoffice" && row.external_edit_url ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                render={
                  <a
                    href={row.external_edit_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink className="size-4" />
                In Lexware
              </Button>
            ) : canManage && row.source === "gwada" ? (
              <Button type="button" size="sm" onClick={onEdit}>
                Bearbeiten
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
