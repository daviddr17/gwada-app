"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Filter,
  Plus,
  Printer,
  Search,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type {
  PosGiftVoucherListStats,
  PosGiftVoucherRow,
} from "@/lib/types/pos-gift-vouchers";
import {
  LIST_PAGE_SIZE_DEFAULT,
  clampListPage,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { moduleDataTableHeadRowClassName } from "@/lib/ui/module-data-table";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import {
  ModuleTableSortHeader,
  type ModuleTableSortDir,
} from "@/lib/ui/module-table-sort-header";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

type VoucherSortKey = "code" | "status" | "balance" | "expires";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  active: "Offen",
  redeemed: "Eingelöst",
  voided: "Storniert",
  expired: "Abgelaufen",
};

export function PosGiftVouchersScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [vouchers, setVouchers] = useState<PosGiftVoucherRow[]>([]);
  const [stats, setStats] = useState<PosGiftVoucherListStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [amountEuro, setAmountEuro] = useState("50");
  const [issuing, setIssuing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<VoucherSortKey>("code");
  const [sortDir, setSortDir] = useState<ModuleTableSortDir>("asc");
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const activeFilterCount = statusFilter ? 1 : 0;

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ restaurantId });
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/pos/gift-vouchers?${params}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        vouchers?: PosGiftVoucherRow[];
        stats?: PosGiftVoucherListStats;
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Gutscheine laden fehlgeschlagen");
        return;
      }
      setVouchers(json.vouchers ?? []);
      setStats(json.stats ?? null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, statusFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const issue = async () => {
    if (!restaurantId) return;
    const euros = Number(String(amountEuro).replace(",", "."));
    if (!Number.isFinite(euros) || euros < 1) {
      toast.error("Mindestbetrag 1,00 €");
      return;
    }
    setIssuing(true);
    try {
      const res = await fetch("/api/pos/gift-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          amountCents: Math.round(euros * 100),
        }),
      });
      const json = (await res.json()) as {
        voucher?: PosGiftVoucherRow;
        error?: string;
      };
      if (!res.ok || !json.voucher) {
        toast.error(json.error ?? "Ausstellung fehlgeschlagen");
        return;
      }
      toast.success(`Gutschein ${json.voucher.code} ausgestellt`);
      setIssueOpen(false);
      await load();
      window.open(
        `/api/pos/gift-vouchers/${json.voucher.id}/print?restaurantId=${encodeURIComponent(restaurantId)}&format=a4`,
        "_blank",
        "noopener,noreferrer",
      );
    } finally {
      setIssuing(false);
    }
  };

  const voidVoucher = async (voucher: PosGiftVoucherRow) => {
    if (!restaurantId) return;
    if (
      !window.confirm(
        `Gutschein ${voucher.code} stornieren und ${formatCents(voucher.balance_cents)} bar erstatten?`,
      )
    ) {
      return;
    }
    setBusyId(voucher.id);
    try {
      const res = await fetch(`/api/pos/gift-vouchers/${voucher.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Storno fehlgeschlagen");
        return;
      }
      toast.success("Gutschein storniert");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const printVoucher = (voucher: PosGiftVoucherRow, format: "a4" | "thermal") => {
    if (!restaurantId) return;
    window.open(
      `/api/pos/gift-vouchers/${voucher.id}/print?restaurantId=${encodeURIComponent(restaurantId)}&format=${format}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const toggleSort = (key: VoucherSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(key === "balance" || key === "expires" ? "desc" : "asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const rows = useMemo(() => {
    const mul = sortDir === "asc" ? 1 : -1;
    return [...vouchers].sort((a, b) => {
      switch (sortKey) {
        case "status":
          return (
            (STATUS_LABEL[a.status] ?? a.status).localeCompare(
              STATUS_LABEL[b.status] ?? b.status,
              "de",
            ) * mul
          );
        case "balance":
          return (a.balance_cents - b.balance_cents) * mul;
        case "expires":
          return (
            (new Date(a.expires_at).getTime() -
              new Date(b.expires_at).getTime()) *
            mul
          );
        case "code":
        default:
          return a.code.localeCompare(b.code, "de") * mul;
      }
    });
  }, [vouchers, sortKey, sortDir]);

  const totalPages = totalPagesFromCount(rows.length, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return rows.slice(start, start + LIST_PAGE_SIZE_DEFAULT);
  }, [rows, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortKey, sortDir]);

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder className="py-10" />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage className="py-10" />;
  }

  return (
    <div className="space-y-4 pt-2">
      {showSkeleton ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Offen"
              value={String(stats?.activeCount ?? 0)}
              hint={formatCents(stats?.activeBalanceCents ?? 0)}
              icon={Ticket}
            />
            <KpiCard
              label="Eingelöst"
              value={String(stats?.redeemedCount ?? 0)}
              hint={formatCents(stats?.redeemedCentsInPeriod ?? 0)}
            />
            <KpiCard
              label="Abgelaufen"
              value={String(stats?.expiredCount ?? 0)}
            />
            <KpiCard
              label="Storniert"
              value={String(stats?.voidedCount ?? 0)}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Code suchen…"
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

          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
            onClick={() => setIssueOpen(true)}
          >
            <Plus className="size-4" />
            Gutschein ausstellen
          </Button>

          {rows.length === 0 ? (
            <Card className="border-border/50 shadow-card">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Noch keine Gutscheine.
              </CardContent>
            </Card>
          ) : (
            <ModulePaginatedDataTable
              shown={paginated.length}
              totalCount={rows.length}
              itemLabel="Gutscheine"
              page={currentPage}
              totalPages={totalPages}
              canPrevious={currentPage > 1}
              canNext={currentPage < totalPages}
              onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className={moduleDataTableHeadRowClassName}>
                    <ModuleTableSortHeader
                      label="Code"
                      sortKey="code"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <ModuleTableSortHeader
                      label="Status"
                      sortKey="status"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <ModuleTableSortHeader
                      label="Guthaben"
                      sortKey="balance"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                      align="right"
                    />
                    <ModuleTableSortHeader
                      label="Gültig bis"
                      sortKey="expires"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <th className="px-3 py-2 text-left font-medium">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((v) => (
                    <tr key={v.id} className="border-t border-border/40">
                      <td className="px-3 py-2.5 font-medium tabular-nums">
                        {v.code}
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatDate(v.issued_at)} ·{" "}
                          {formatCents(v.initial_amount_cents)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {STATUS_LABEL[v.status] ?? v.status}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                        {formatCents(v.balance_cents)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatDate(v.expires_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={v.status === "voided"}
                            onClick={() => printVoucher(v, "a4")}
                          >
                            <Printer className="size-3.5" />
                            A4
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={v.status === "voided"}
                            onClick={() => printVoucher(v, "thermal")}
                          >
                            Bon
                          </Button>
                          {v.status === "active" &&
                          v.balance_cents === v.initial_amount_cents ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busyId === v.id}
                              onClick={() => void voidVoucher(v)}
                            >
                              Storno
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
        </>
      )}

      <Drawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Filter</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-2">
            <Label>Status</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "", label: "Alle" },
                { value: "active", label: "Offen" },
                { value: "redeemed", label: "Eingelöst" },
                { value: "expired", label: "Abgelaufen" },
                { value: "voided", label: "Storniert" },
              ].map((opt) => (
                <Button
                  key={opt.value || "all"}
                  type="button"
                  size="sm"
                  variant={statusFilter === opt.value ? "default" : "outline"}
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <DrawerFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setStatusFilter("");
                setFilterOpen(false);
              }}
            >
              Zurücksetzen
            </Button>
            <Button
              type="button"
              className={cn("flex-1", brandActionButtonRoundedClassName)}
              onClick={() => setFilterOpen(false)}
            >
              Fertig
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={issueOpen}
        onOpenChange={setIssueOpen}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Gutschein ausstellen</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-2">
            <Card className="border-border/50 shadow-none">
              <CardContent className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gv-amount">Betrag (EUR)</Label>
                  <Input
                    id="gv-amount"
                    inputMode="decimal"
                    value={amountEuro}
                    onChange={(e) => setAmountEuro(e.target.value)}
                    placeholder="50"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Barzahlung wird ins Kassenbuch mit 0 % gebucht. Umsatzsteuer
                  entsteht erst bei Einlösung der Speisen. Gültigkeit laut
                  Einstellung (Standard 3 Jahre).
                </p>
              </CardContent>
            </Card>
          </div>
          <DrawerFooter>
            <Button
              type="button"
              className={cn("w-full", brandActionButtonRoundedClassName)}
              disabled={issuing}
              onClick={() => void issue()}
            >
              {issuing ? "Wird ausgestellt…" : "Bar kassieren & drucken"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
