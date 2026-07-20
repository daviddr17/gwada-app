"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  FileText,
  Filter,
  Loader2,
  RotateCcw,
  Search,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { PosFormalInvoiceDrawer } from "@/components/pos/pos-formal-invoice-drawer";
import {
  countPosDateRangeFilters,
  PosListFilterDrawer,
} from "@/components/pos/pos-list-filter-drawer";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  LIST_PAGE_SIZE_DEFAULT,
  clampListPage,
} from "@/lib/constants/list-pagination";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  fetchPosReceipts,
  fetchPosVoidReasons,
  posApiErrorLabel,
  regeneratePosReceipt,
  voidPosCashPayment,
  type PosVoidReasonDto,
  type PosWebReceiptDto,
} from "@/lib/pos/pos-web-api-client";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { moduleDataTableHeadRowClassName } from "@/lib/ui/module-data-table";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import {
  ModuleTableSortHeader,
  type ModuleTableSortDir,
} from "@/lib/ui/module-table-sort-header";

type MethodFilter = "all" | "cash" | "card" | "other" | "refunded";
type ReceiptSortKey = "paidAt" | "orderNumber" | "table" | "method" | "amount";

const METHOD_OPTIONS = [
  { value: "all", label: "Alle Zahlungen" },
  { value: "cash", label: "Bar" },
  { value: "card", label: "Karte / Unbar" },
  { value: "other", label: "Sonstige" },
  { value: "refunded", label: "Nur Stornos" },
] as const;

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
  const canCreateFormalInvoice = has("accounting.create");
  const today = useMemo(() => todayYmdLocal(), []);

  const [fromYmd, setFromYmd] = useState(today);
  const [toYmd, setToYmd] = useState(today);
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [receipts, setReceipts] = useState<PosWebReceiptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<ReceiptSortKey>("paidAt");
  const [sortDir, setSortDir] = useState<ModuleTableSortDir>("desc");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<PosWebReceiptDto | null>(null);
  const [voidReasons, setVoidReasons] = useState<PosVoidReasonDto[]>([]);
  const [voidReasonId, setVoidReasonId] = useState<string | null>(null);
  const [voidReasonsLoading, setVoidReasonsLoading] = useState(false);
  const [reopenTable, setReopenTable] = useState(true);
  const [formalInvoicePaymentId, setFormalInvoicePaymentId] = useState<
    string | null
  >(null);
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const rangeInvalid = fromYmd > toYmd;
  const activeFilterCount = countPosDateRangeFilters({
    fromYmd,
    toYmd,
    defaultFromYmd: today,
    defaultToYmd: today,
    selectValue: methodFilter,
  });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [fromYmd, toYmd, methodFilter, debouncedSearch]);

  const load = useCallback(async () => {
    if (!restaurantId || rangeInvalid) {
      setReceipts([]);
      setTotalCount(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchPosReceipts(restaurantId, fromYmd, toYmd, {
        page,
        pageSize: LIST_PAGE_SIZE_DEFAULT,
        method: methodFilter,
        search: debouncedSearch || undefined,
      });
      if (!result.ok) {
        toast.error(posApiErrorLabel(result.error));
        setReceipts([]);
        setTotalCount(0);
        setTotalPages(1);
        return;
      }
      setReceipts(result.data.receipts);
      setTotalCount(result.data.totalCount);
      setTotalPages(result.data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [
    restaurantId,
    fromYmd,
    toYmd,
    rangeInvalid,
    page,
    methodFilter,
    debouncedSearch,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSort = (key: ReceiptSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(
        key === "paidAt" || key === "amount" || key === "orderNumber"
          ? "desc"
          : "asc",
      );
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const paginated = useMemo(() => {
    const mul = sortDir === "asc" ? 1 : -1;
    return [...receipts].sort((a, b) => {
      switch (sortKey) {
        case "orderNumber":
          return (a.orderNumber - b.orderNumber) * mul;
        case "table":
          return a.tableLabel.localeCompare(b.tableLabel, "de") * mul;
        case "method":
          return (
            methodLabel(a.method).localeCompare(methodLabel(b.method), "de") *
            mul
          );
        case "amount":
          return (
            (a.amountCents + a.tipCents - (b.amountCents + b.tipCents)) * mul
          );
        case "paidAt":
        default: {
          const at = a.paidAt ? new Date(a.paidAt).getTime() : 0;
          const bt = b.paidAt ? new Date(b.paidAt).getTime() : 0;
          return (at - bt) * mul;
        }
      }
    });
  }, [receipts, sortKey, sortDir]);

  const currentPage = clampListPage(page, totalPages);

  const openVoidDrawer = async (receipt: PosWebReceiptDto) => {
    if (!restaurantId || !canManage) return;
    setVoidTarget(receipt);
    setVoidReasonId(null);
    setReopenTable(true);
    setVoidReasonsLoading(true);
    try {
      const result = await fetchPosVoidReasons(restaurantId);
      if (!result.ok) {
        toast.error(posApiErrorLabel(result.error));
        setVoidReasons([]);
        return;
      }
      const active = (result.data.reasons ?? []).filter((r) => r.isActive);
      setVoidReasons(active);
      if (active.length === 1) setVoidReasonId(active[0]!.id);
    } finally {
      setVoidReasonsLoading(false);
    }
  };

  const confirmVoid = async () => {
    if (!restaurantId || !canManage || !voidTarget) return;
    if (voidReasons.length > 0 && !voidReasonId) {
      toast.error("Bitte einen Storno-Grund wählen.");
      return;
    }
    setBusyId(`void-${voidTarget.paymentId}`);
    try {
      const result = await voidPosCashPayment(
        restaurantId,
        voidTarget.paymentId,
        reopenTable,
        voidReasonId,
      );
      if (!result.ok) {
        toast.error(posApiErrorLabel(result.error));
        return;
      }
      const parts = [
        result.data.reopened
          ? "Storniert — Tisch wieder geöffnet"
          : "Barzahlung storniert",
      ];
      if (result.data.inventoryRestored) {
        parts.push("Bestand zurückgebucht");
      }
      const inv = result.data.formalInvoiceStorno;
      if (inv?.mode === "correction") {
        parts.push(
          inv.correctionNumber
            ? `Rechnung → Korrektur ${inv.correctionNumber}`
            : "Formale Rechnung korrigiert",
        );
      } else if (inv?.mode === "voided_draft") {
        parts.push(
          inv.invoiceNumber
            ? `Rechnung ${inv.invoiceNumber} storniert`
            : "Formale Rechnung storniert",
        );
      } else if (inv?.error) {
        toast.warning(
          `Bar storniert — Rechnungsstorno fehlgeschlagen: ${inv.error}`,
        );
        setVoidTarget(null);
        await load();
        return;
      }
      toast.success(parts.join(" · "));
      setVoidTarget(null);
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
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Bon-Nr., Tisch, Zahlungsart…"
            className="h-10 pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="relative rounded-full border-border/60"
          onClick={() => setFilterOpen(true)}
          aria-label="Filter"
        >
          <Filter className="size-4" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </div>

      {rangeInvalid ? (
        <p className="text-sm text-destructive">
          Das Enddatum muss am oder nach dem Startdatum liegen.
        </p>
      ) : null}

      {showSkeleton ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : totalCount === 0 ? (
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
          totalCount={totalCount}
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
                <ModuleTableSortHeader
                  label="Zeit"
                  sortKey="paidAt"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <ModuleTableSortHeader
                  label="Bon"
                  sortKey="orderNumber"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <ModuleTableSortHeader
                  label="Tisch"
                  sortKey="table"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <ModuleTableSortHeader
                  label="Art"
                  sortKey="method"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <ModuleTableSortHeader
                  label="Betrag"
                  sortKey="amount"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  align="right"
                />
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
                        {receipt.status === "paid" && canCreateFormalInvoice ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            disabled={voidBusy || pdfBusy}
                            onClick={() =>
                              setFormalInvoicePaymentId(receipt.paymentId)
                            }
                          >
                            <FileText className="size-3.5" aria-hidden />
                            Rechnung
                          </Button>
                        ) : null}
                        {receipt.canVoidCash && canManage ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            disabled={voidBusy || pdfBusy}
                            onClick={() => void openVoidDrawer(receipt)}
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

      <PosListFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        description="Zeitraum und Zahlungsart für Quittungen."
        fromYmd={fromYmd}
        toYmd={toYmd}
        onFromYmdChange={setFromYmd}
        onToYmdChange={setToYmd}
        selectLabel="Zahlungsart"
        selectValue={methodFilter}
        selectOptions={[...METHOD_OPTIONS]}
        onSelectChange={(v) => setMethodFilter(v as MethodFilter)}
        onReset={() => {
          setFromYmd(today);
          setToYmd(today);
          setMethodFilter("all");
        }}
      />

      <PosFormalInvoiceDrawer
        open={formalInvoicePaymentId != null}
        onOpenChange={(open) => {
          if (!open) setFormalInvoicePaymentId(null);
        }}
        restaurantId={restaurantId}
        paymentId={formalInvoicePaymentId}
        onCreated={() => {
          void load();
        }}
      />

      <Drawer
        open={voidTarget != null}
        onOpenChange={(open) => {
          if (!open) setVoidTarget(null);
        }}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Barzahlung stornieren</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">
            {voidTarget ? (
              <p className="text-sm text-muted-foreground">
                #{voidTarget.orderNumber} · {formatCents(voidTarget.amountCents)}
              </p>
            ) : null}
            {voidReasonsLoading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : voidReasons.length > 0 ? (
              <div className="space-y-2">
                <Label>Storno-Grund</Label>
                <div className="flex flex-col gap-2">
                  {voidReasons.map((reason) => {
                    const selected = voidReasonId === reason.id;
                    return (
                      <button
                        key={reason.id}
                        type="button"
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                          selected
                            ? "border-accent/50 bg-accent/10"
                            : "border-border/50 bg-muted/20",
                        )}
                        onClick={() => setVoidReasonId(reason.id)}
                      >
                        <span className="font-medium">{reason.name}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {reason.restoreInventory
                            ? "Bestand wird zurückgebucht"
                            : "Bestand bleibt abgezogen"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Kein Storno-Grund hinterlegt — Storno ohne Grund-Auswahl.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={reopenTable}
                onChange={(e) => setReopenTable(e.target.checked)}
              />
              Tisch wieder öffnen
            </label>
          </div>
          <DrawerFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setVoidTarget(null)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className={cn("flex-1", brandActionButtonRoundedClassName)}
              disabled={
                Boolean(busyId) ||
                voidReasonsLoading ||
                (voidReasons.length > 0 && !voidReasonId)
              }
              onClick={() => void confirmVoid()}
            >
              {busyId ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Stornieren
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
