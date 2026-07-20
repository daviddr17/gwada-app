"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Search, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import {
  countPosDateRangeFilters,
  PosListFilterDrawer,
} from "@/components/pos/pos-list-filter-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  fetchPosOrdersList,
  posApiErrorLabel,
  type PosWebOrderListItemDto,
} from "@/lib/pos/pos-web-api-client";
import { moduleDataTableHeadRowClassName } from "@/lib/ui/module-data-table";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import {
  ModuleTableSortHeader,
  type ModuleTableSortDir,
} from "@/lib/ui/module-table-sort-header";

type StatusFilter = "all" | "open" | "delivered" | "cancelled";
type SortKey = "createdAt" | "orderNumber" | "status" | "total" | "table";

const STATUS_OPTIONS = [
  { value: "all", label: "Alle Status" },
  { value: "open", label: "Offen" },
  { value: "delivered", label: "Abgeschlossen" },
  { value: "cancelled", label: "Storniert" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Offen",
  received: "Eingegangen",
  preparing: "In Zubereitung",
  ready: "Fertig",
  delivered: "Abgeschlossen",
  cancelled: "Storniert",
};

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

function PosOrdersSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function PosOrdersScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const today = useMemo(() => todayYmdLocal(), []);
  const [fromYmd, setFromYmd] = useState(today);
  const [toYmd, setToYmd] = useState(today);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [orders, setOrders] = useState<PosWebOrderListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<ModuleTableSortDir>("desc");
  const showSkeleton = useDeferredSkeleton(!ready || loading);
  const rangeInvalid = fromYmd > toYmd;

  const activeFilterCount = countPosDateRangeFilters({
    fromYmd,
    toYmd,
    defaultFromYmd: today,
    defaultToYmd: today,
    selectValue: statusFilter,
  });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [fromYmd, toYmd, statusFilter, debouncedSearch]);

  const load = useCallback(async () => {
    if (!restaurantId || rangeInvalid) {
      setOrders([]);
      setTotalCount(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchPosOrdersList(restaurantId, fromYmd, toYmd, {
        status: statusFilter,
        page,
        pageSize: LIST_PAGE_SIZE_DEFAULT,
        search: debouncedSearch || undefined,
      });
      if (!result.ok) {
        toast.error(posApiErrorLabel(result.error));
        setOrders([]);
        setTotalCount(0);
        setTotalPages(1);
        return;
      }
      setOrders(result.data.orders);
      setTotalCount(result.data.totalCount);
      setTotalPages(result.data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [
    restaurantId,
    fromYmd,
    toYmd,
    statusFilter,
    rangeInvalid,
    page,
    debouncedSearch,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(key === "createdAt" || key === "total" ? "desc" : "asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  /** Sort within the current server page (server orders by created_at desc). */
  const paginated = useMemo(() => {
    const mul = sortDir === "asc" ? 1 : -1;
    return [...orders].sort((a, b) => {
      switch (sortKey) {
        case "orderNumber":
          return (a.orderNumber - b.orderNumber) * mul;
        case "status":
          return (
            (STATUS_LABEL[a.status] ?? a.status).localeCompare(
              STATUS_LABEL[b.status] ?? b.status,
              "de",
            ) * mul
          );
        case "total":
          return (a.totalCents - b.totalCents) * mul;
        case "table":
          return a.tableLabel.localeCompare(b.tableLabel, "de") * mul;
        case "createdAt":
        default:
          return (
            (new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()) *
            mul
          );
      }
    });
  }, [orders, sortKey, sortDir]);

  const currentPage = clampListPage(page, totalPages);

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
            placeholder="Bon-Nr., Tisch, Artikel…"
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
        <PosOrdersSkeleton />
      ) : totalCount === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/50 bg-muted/20 px-4 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                <ShoppingBag
                  className="size-6 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <p className="text-sm font-medium">Keine Bestellungen</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Im gewählten Zeitraum gibt es keine passenden Bestellungen.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ModulePaginatedDataTable
          shown={paginated.length}
          totalCount={totalCount}
          itemLabel="Bestellungen"
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
                  sortKey="createdAt"
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
                  label="Status"
                  sortKey="status"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <th className="px-3 py-2 text-left font-medium">Positionen</th>
                <ModuleTableSortHeader
                  label="Summe"
                  sortKey="total"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {paginated.map((order) => (
                <tr key={order.id} className="border-t border-border/40">
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums font-medium">
                    #{order.orderNumber}
                  </td>
                  <td className="px-3 py-2.5">{order.tableLabel}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline">
                      {STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                  </td>
                  <td className="max-w-[16rem] px-3 py-2.5 text-muted-foreground">
                    <span className="line-clamp-2">{order.linePreview}</span>
                    <span className="mt-0.5 block text-xs">
                      {order.itemQuantity} Stück · {order.lineCount} Zeilen
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                    {formatCents(order.totalCents + order.tipCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModulePaginatedDataTable>
      )}

      <PosListFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        fromYmd={fromYmd}
        toYmd={toYmd}
        onFromYmdChange={setFromYmd}
        onToYmdChange={setToYmd}
        selectValue={statusFilter}
        selectOptions={[...STATUS_OPTIONS]}
        onSelectChange={(v) => setStatusFilter(v as StatusFilter)}
        onReset={() => {
          setFromYmd(today);
          setToYmd(today);
          setStatusFilter("all");
        }}
      />
    </div>
  );
}
