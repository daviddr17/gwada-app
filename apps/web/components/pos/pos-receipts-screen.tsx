"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  LIST_PAGE_SIZE_DEFAULT,
  clampListPage,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  fetchPosReceipts,
  posApiErrorLabel,
  regeneratePosReceipt,
  voidPosCashPayment,
  type PosWebReceiptDto,
} from "@/lib/pos/pos-web-api-client";
import { moduleDataTableHeadRowClassName } from "@/lib/ui/module-data-table";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function methodLabel(method: string): string {
  const m = method.trim().toLowerCase();
  if (m === "cash" || m === "bar") return "Bar";
  if (m === "card" || m === "karte" || m === "mollie" || m === "terminal") {
    return "Karte";
  }
  return method || "—";
}

export function PosReceiptsScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has } = useRestaurantPermissions();
  const canManage = has("pos.kasse.manage");

  const [fromYmd, setFromYmd] = useState(todayYmdLocal);
  const [toYmd, setToYmd] = useState(todayYmdLocal);
  const [receipts, setReceipts] = useState<PosWebReceiptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const rangeInvalid = fromYmd > toYmd;

  const load = useCallback(async () => {
    if (!restaurantId || rangeInvalid) {
      setReceipts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchPosReceipts(restaurantId, fromYmd, toYmd);
      if (!result.ok) {
        toast.error(posApiErrorLabel(result.error));
        setReceipts([]);
        return;
      }
      setReceipts(result.data.receipts);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, fromYmd, toYmd, rangeInvalid]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = totalPagesFromCount(receipts.length, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return receipts.slice(start, start + LIST_PAGE_SIZE_DEFAULT);
  }, [receipts, currentPage]);

  const handleVoid = async (receipt: PosWebReceiptDto) => {
    if (!restaurantId || !canManage) return;
    const ok = window.confirm(
      `Barzahlung #${receipt.orderNumber} stornieren und Tisch ggf. wieder öffnen?`,
    );
    if (!ok) return;
    setBusyId(`void-${receipt.paymentId}`);
    try {
      const result = await voidPosCashPayment(
        restaurantId,
        receipt.paymentId,
        true,
      );
      if (!result.ok) {
        toast.error(posApiErrorLabel(result.error));
        return;
      }
      toast.success(
        result.data.reopened
          ? "Storniert — Tisch wieder geöffnet"
          : "Barzahlung storniert",
      );
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleRegenerate = async (receipt: PosWebReceiptDto) => {
    if (!restaurantId || !canManage) return;
    setBusyId(`pdf-${receipt.paymentId}`);
    try {
      const result = await regeneratePosReceipt(
        restaurantId,
        receipt.orderId,
      );
      if (!result.ok) {
        toast.error(posApiErrorLabel(result.error));
        return;
      }
      const url = result.data.order?.receiptUrl;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      toast.success("Quittung aktualisiert");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder className="py-10" />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage className="py-10" />;
  }

  return (
    <div className="space-y-4 pt-2">
      <Card className="border-border/50 shadow-card">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pos-receipts-from">Von</Label>
            <DatePickerField
              id="pos-receipts-from"
              value={fromYmd}
              onChange={(v) => setFromYmd(v ?? fromYmd)}
              fullWidth
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pos-receipts-to">Bis</Label>
            <DatePickerField
              id="pos-receipts-to"
              value={toYmd}
              onChange={(v) => setToYmd(v ?? toYmd)}
              minYmd={fromYmd}
              fullWidth
            />
          </div>
          {rangeInvalid ? (
            <p className="text-sm text-destructive sm:col-span-2">
              Das Enddatum muss am oder nach dem Startdatum liegen.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {showSkeleton ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : receipts.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                <FileText
                  className="size-6 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <p className="text-sm font-medium">Keine Quittungen</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Im gewählten Zeitraum liegen keine bezahlten oder stornierten
                Zahlungen vor.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ModulePaginatedDataTable
          shown={paginated.length}
          totalCount={receipts.length}
          itemLabel="Quittungen"
          page={currentPage}
          totalPages={totalPages}
          canPrevious={currentPage > 1}
          canNext={currentPage < totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className={moduleDataTableHeadRowClassName}>
                <th className="px-3 py-2 text-left font-medium">Zeit</th>
                <th className="px-3 py-2 text-left font-medium">Bon</th>
                <th className="px-3 py-2 text-left font-medium">Tisch</th>
                <th className="px-3 py-2 text-left font-medium">Art</th>
                <th className="px-3 py-2 text-right font-medium">Betrag</th>
                <th className="px-3 py-2 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((receipt) => {
                const voidBusy = busyId === `void-${receipt.paymentId}`;
                const pdfBusy = busyId === `pdf-${receipt.paymentId}`;
                const gross = receipt.amountCents + receipt.tipCents;
                return (
                  <tr
                    key={receipt.paymentId}
                    className="border-t border-border/40"
                  >
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                      {formatDateTime(receipt.paidAt)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      #{receipt.orderNumber}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span>{receipt.tableLabel}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {receipt.sessionStatus}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{methodLabel(receipt.method)}</Badge>
                        {receipt.status === "refunded" ? (
                          <Badge variant="destructive">Storniert</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="font-medium tabular-nums">
                        {formatCents(gross)}
                      </div>
                      {receipt.tipCents > 0 ? (
                        <div className="text-xs text-muted-foreground tabular-nums">
                          inkl. {formatCents(receipt.tipCents)} Tip
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {receipt.receiptPdfUrl ? (
                          <a
                            href={receipt.receiptPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "rounded-lg",
                            )}
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                            PDF
                          </a>
                        ) : canManage ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            disabled={pdfBusy || voidBusy}
                            onClick={() => void handleRegenerate(receipt)}
                          >
                            {pdfBusy ? (
                              <Loader2
                                className="size-3.5 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <RotateCcw className="size-3.5" aria-hidden />
                            )}
                            PDF
                          </Button>
                        ) : null}
                        {receipt.canVoidCash && canManage ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            disabled={voidBusy || pdfBusy}
                            onClick={() => void handleVoid(receipt)}
                          >
                            {voidBusy ? (
                              <Loader2
                                className="size-3.5 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Undo2 className="size-3.5" aria-hidden />
                            )}
                            Storno
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ModulePaginatedDataTable>
      )}
    </div>
  );
}
