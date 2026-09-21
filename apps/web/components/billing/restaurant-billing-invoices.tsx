"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RestaurantBillingInvoiceDto } from "@/lib/billing/restaurant-invoice-types";
import {
  billingReasonLabel,
  billingStatusLabel,
  formatBillingDate,
  formatEurFromCents,
} from "@/lib/billing/billing-status-labels";
import {
  LIST_PAGE_SIZE_DEFAULT,
  clampListPage,
  paginateListItems,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import {
  moduleDataTableHeadCellClassName,
  moduleDataTableHeadRowClassName,
} from "@/lib/ui/module-data-table";
import { cn } from "@/lib/utils";

function invoiceStatusClass(status: string): string {
  if (status === "paid") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (status === "payment_failed" || status === "uncollectible") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  if (status === "open") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  }
  return "";
}

export function RestaurantBillingInvoices({
  restaurantId,
  hasStripeCustomer,
  reloadToken,
}: {
  restaurantId: string;
  hasStripeCustomer: boolean;
  reloadToken: number;
}) {
  const [invoices, setInvoices] = useState<RestaurantBillingInvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/billing/invoices?restaurantId=${encodeURIComponent(restaurantId)}`,
      );
      const data = (await res.json()) as {
        invoices?: RestaurantBillingInvoiceDto[];
      };
      setInvoices(res.ok && Array.isArray(data.invoices) ? data.invoices : []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const totalPages = totalPagesFromCount(invoices.length, LIST_PAGE_SIZE_DEFAULT);
  const safePage = clampListPage(page, totalPages);
  const paged = useMemo(
    () => paginateListItems(invoices, safePage, LIST_PAGE_SIZE_DEFAULT),
    [invoices, safePage],
  );

  useEffect(() => {
    setPage(1);
  }, [invoices.length]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold tracking-tight">
          Rechnungen & Belege
        </h3>
        <p className="text-sm text-muted-foreground">
          Gwada-Abo für diesen Betrieb — PDF und Belegseite zum Speichern. Nicht
          die Gast-Rechnungen aus der Buchführung.
        </p>
      </div>

      {showSkeleton ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : invoices.length === 0 ? (
        <p className="rounded-xl border border-border/50 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          {hasStripeCustomer
            ? "Noch keine Rechnungen. Sobald Stripe abbucht, erscheinen Belege hier."
            : "Nach dem ersten bezahlten Abo liegen Rechnungen und PDFs hier bereit."}
        </p>
      ) : (
        <ModulePaginatedDataTable
          shown={paged.items.length}
          totalCount={paged.totalCount}
          itemLabel="Rechnungen"
          page={paged.page}
          totalPages={paged.totalPages}
          canPrevious={paged.page > 1}
          canNext={paged.page < paged.totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className={moduleDataTableHeadRowClassName}>
                <th className={moduleDataTableHeadCellClassName}>Nummer</th>
                <th className={moduleDataTableHeadCellClassName}>Datum</th>
                <th className={moduleDataTableHeadCellClassName}>Zeitraum</th>
                <th className={cn(moduleDataTableHeadCellClassName, "text-right")}>
                  Betrag
                </th>
                <th className={moduleDataTableHeadCellClassName}>Status</th>
                <th className={moduleDataTableHeadCellClassName}>Beleg</th>
              </tr>
            </thead>
            <tbody>
              {paged.items.map((row) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-medium tabular-nums">
                    {row.number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatBillingDate(row.paidAt ?? row.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.periodStart || row.periodEnd
                      ? `${formatBillingDate(row.periodStart)} – ${formatBillingDate(row.periodEnd)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatEurFromCents(
                      row.status === "paid" ? row.amountPaid : row.amountDue,
                      row.currency,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn("rounded-full", invoiceStatusClass(row.status))}
                    >
                      {billingStatusLabel(row.status)}
                    </Badge>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {billingReasonLabel(row.billingReason)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {row.invoicePdf ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="PDF herunterladen"
                          render={
                            <a
                              href={row.invoicePdf}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          <Download className="size-3.5" />
                        </Button>
                      ) : null}
                      {row.hostedInvoiceUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Beleg öffnen"
                          render={
                            <a
                              href={row.hostedInvoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          <ExternalLink className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModulePaginatedDataTable>
      )}
    </div>
  );
}
