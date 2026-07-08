"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Package, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DisplayInventoryExportSheet } from "@/components/display/display-inventory-export-sheet";
import type {
  DisplayInventoryFilterOption,
  DisplayInventoryIngredientRow,
  DisplayInventoryPayload,
} from "@/lib/display/display-inventory-server";
import { GWADA_DISPLAY_INVENTORY_REFRESH_EVENT } from "@/lib/display/display-inventory-live-events";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { reservationsDayDrawerHeaderActionButtonClassName } from "@/components/reservations/reservations-day-drawer-toolbar";
import { displayModuleContentClassName } from "@/lib/ui/display-module-content";
import { cn } from "@/lib/utils";

type ViewMode = "stock" | "order";

type DisplayInventoryModuleProps = {
  restaurantName?: string;
};

const ALL = "all";

const touchQtyInputClass =
  "h-14 w-full rounded-2xl border border-input bg-background px-4 text-center text-2xl font-semibold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45";

const filterSelectClass = appSelectTriggerAccentCn(
  "h-12 min-w-0 flex-1 rounded-2xl text-base [&_[data-slot=select-value]]:truncate",
);

function parseQty(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseFloat(t.replace(",", "."));
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

function DisplayInventoryCard({
  row,
  mode,
  focused,
  onFocusRequest,
  onCommitted,
  onAdvance,
  onReleaseFocus,
  registerInput,
}: {
  row: DisplayInventoryIngredientRow;
  mode: ViewMode;
  focused: boolean;
  onFocusRequest: () => void;
  onCommitted: (
    nextId: string | null,
    patch?: Partial<DisplayInventoryIngredientRow>,
  ) => void;
  onAdvance: (id: string) => void;
  onReleaseFocus: () => void;
  registerInput: (id: string, el: HTMLInputElement | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedStock, setSavedStock] = useState(row.currentStock);
  const [savedOrderQty, setSavedOrderQty] = useState(row.orderQuantity);
  const [orderMeta, setOrderMeta] = useState({
    orderId: row.orderId,
    orderLineId: row.orderLineId,
  });

  useEffect(() => {
    setSavedStock(row.currentStock);
    setSavedOrderQty(row.orderQuantity);
    setOrderMeta({ orderId: row.orderId, orderLineId: row.orderLineId });
  }, [row.currentStock, row.orderId, row.orderLineId, row.orderQuantity]);

  const prevFocusedRef = useRef(false);
  const autoFocusDoneRef = useRef(false);

  useEffect(() => {
    if (focused && !prevFocusedRef.current) {
      if (mode === "stock") {
        setDraft("");
      } else {
        setDraft(
          orderMeta.orderLineId || savedOrderQty > 0 ? String(savedOrderQty) : "",
        );
      }
    }
    if (!focused) setDraft("");
    prevFocusedRef.current = focused;
  }, [focused, mode, orderMeta.orderLineId, savedOrderQty]);

  useEffect(() => {
    registerInput(row.id, inputRef.current);
    return () => registerInput(row.id, null);
  }, [registerInput, row.id]);

  useEffect(() => {
    if (focused && !autoFocusDoneRef.current && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      autoFocusDoneRef.current = true;
    }
    if (!focused) autoFocusDoneRef.current = false;
  }, [focused]);

  const commit = useCallback(async (options?: { advanceOnSuccess?: boolean }) => {
    if (busy) return;
    if (mode === "order" && !row.canOrder) {
      toast.error(
        "Diese Zutat hat keinen Lieferanten und kann nicht bestellt werden.",
      );
      return;
    }

    setBusy(true);
    try {
      if (mode === "stock") {
        const raw = draft.trim();
        if (raw === "") {
          onCommitted(null);
          return;
        }
        const n = parseQty(raw);
        if (n === null) {
          toast.error("Bitte eine gültige Menge (≥ 0) eingeben.");
          return;
        }
        if (n === savedStock) {
          onCommitted(null);
          return;
        }
        const res = await fetch("/api/display/inventory/stock", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ingredient_id: row.id,
            current_stock: n,
          }),
        });
        if (!res.ok) {
          toast.error("Bestand konnte nicht gespeichert werden.");
          return;
        }
        const data = (await res.json()) as { current_stock?: number };
        const next = data.current_stock ?? n;
        setSavedStock(next);
        setDraft("");
        toast.success(`${row.name}: Bestand ${savedStock} → ${next} ${row.unitLabel}`);
        onCommitted(row.id, { currentStock: next });
        if (options?.advanceOnSuccess) onAdvance(row.id);
        return;
      }

      const raw = draft.trim();
      const q = raw === "" ? 0 : parseQty(raw);
      if (q === null) {
        toast.error("Bitte eine gültige Menge (≥ 0) eingeben.");
        return;
      }
      if (q === savedOrderQty && orderMeta.orderLineId) {
        onCommitted(null);
        return;
      }
      if (!orderMeta.orderLineId && q === 0) {
        onCommitted(null);
        return;
      }

      const res = await fetch("/api/display/inventory/order-line", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient_id: row.id,
          quantity: q,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        if (err.error === "no_supplier") {
          toast.error(
            "Diese Zutat hat keinen Lieferanten und kann nicht bestellt werden.",
          );
        } else {
          toast.error("Bestellmenge konnte nicht gespeichert werden.");
        }
        return;
      }
      const data = (await res.json()) as {
        order_id?: string | null;
        order_line_id?: string | null;
        order_quantity?: number;
      };
      const orderQuantity = data.order_quantity ?? q;
      const orderLineId = data.order_line_id ?? null;
      const orderId = data.order_id ?? orderMeta.orderId;
      setSavedOrderQty(orderQuantity);
      setOrderMeta({ orderId, orderLineId });
      setDraft("");
      toast.success(
        `${row.name}: Bestellmenge ${orderQuantity} ${row.unitLabel}`,
      );
      onCommitted(row.id, {
        orderQuantity,
        orderLineId,
        orderId,
      });
      if (options?.advanceOnSuccess) onAdvance(row.id);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    draft,
    mode,
    onAdvance,
    onCommitted,
    orderMeta.orderId,
    orderMeta.orderLineId,
    row.canOrder,
    row.id,
    row.name,
    row.unitLabel,
    savedOrderQty,
    savedStock,
  ]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void commit({ advanceOnSuccess: true });
        return;
      }
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        void (async () => {
          await commit({ advanceOnSuccess: false });
          onAdvance(row.id);
        })();
      }
    },
    [commit, onAdvance, row.id],
  );

  const handleInputBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (!focused) return;
      const rel = e.relatedTarget as HTMLElement | null;
      if (rel?.closest("[data-inventory-toolbar]")) {
        onReleaseFocus();
        void commit({ advanceOnSuccess: false });
        return;
      }
      if (rel?.closest("[data-inventory-card]")) {
        void commit({ advanceOnSuccess: false });
        return;
      }
      void commit({ advanceOnSuccess: false });
    },
    [commit, focused, onReleaseFocus],
  );

  const disabledOrder = mode === "order" && !row.canOrder;

  return (
    <div
      data-inventory-card
      role="group"
      aria-label={row.name}
      onPointerDown={(e) => {
        if (disabledOrder) return;
        if ((e.target as HTMLElement).closest("input")) return;
        onFocusRequest();
      }}
      className={cn(
        "flex min-h-[10.5rem] cursor-pointer flex-col rounded-3xl border border-border/50 bg-card p-4 text-left shadow-card transition-colors",
        "active:scale-[0.99]",
        focused && "border-accent ring-2 ring-accent/30",
        disabledOrder && "cursor-not-allowed opacity-55",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-lg font-semibold leading-snug">{row.name}</p>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {row.productionSiteName} · {row.categoryName} · {row.supplierName}
        </p>
      </div>

      {mode === "stock" ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Bestand{" "}
            <span className="font-medium tabular-nums text-foreground">
              {savedStock} {row.unitLabel}
            </span>
          </p>
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              disabled={busy || !focused}
              placeholder="Neuer Wert"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              onFocus={() => onFocusRequest()}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className={cn(touchQtyInputClass, "pr-14")}
              aria-label={`Neuer Bestand ${row.name} (${row.unitId})`}
            />
            <span
              className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-lg font-medium text-muted-foreground tabular-nums"
              aria-hidden
            >
              {row.unitId}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Bestand{" "}
            <span className="font-medium tabular-nums text-foreground">
              {savedStock} {row.unitLabel}
            </span>
          </p>
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              disabled={busy || !focused || disabledOrder}
              placeholder="Bestellmenge"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              onFocus={() => onFocusRequest()}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className={cn(touchQtyInputClass, "pr-14")}
              aria-label={`Bestellmenge ${row.name} (${row.unitId})`}
            />
            <span
              className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-lg font-medium text-muted-foreground tabular-nums"
              aria-hidden
            >
              {row.unitId}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function DisplayInventoryModule({ restaurantName }: DisplayInventoryModuleProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DisplayInventoryPayload | null>(null);
  const showDataSkeleton = useDeferredSkeleton(loading && !data);
  const [mode, setMode] = useState<ViewMode>("stock");
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState(ALL);
  const [filterCategory, setFilterCategory] = useState(ALL);
  const [filterProduction, setFilterProduction] = useState(ALL);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());

  const registerInput = useCallback((id: string, el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(id, el);
    else inputRefs.current.delete(id);
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/display/inventory", { cache: "no-store" });
      if (!res.ok) {
        if (!opts?.silent) {
          toast.error("Bestand konnte nicht geladen werden.");
        }
        return;
      }
      const payload = (await res.json()) as DisplayInventoryPayload;
      setData(payload);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => {
      void load({ silent: true });
    };
    window.addEventListener(GWADA_DISPLAY_INVENTORY_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(GWADA_DISPLAY_INVENTORY_REFRESH_EVENT, onRefresh);
    };
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    let rows = data.ingredients;
    if (filterSupplier !== ALL) {
      rows = rows.filter((r) => r.supplierId === filterSupplier);
    }
    if (filterCategory !== ALL) {
      rows = rows.filter((r) => r.categoryId === filterCategory);
    }
    if (filterProduction !== ALL) {
      rows = rows.filter((r) => r.productionSiteId === filterProduction);
    }
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q) ||
          r.categoryName.toLowerCase().includes(q) ||
          r.productionSiteName.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data, filterCategory, filterProduction, filterSupplier, search]);

  const focusNextAfter = useCallback(
    (currentId: string | null) => {
      if (filtered.length === 0) {
        setFocusedId(null);
        return;
      }
      const idx = currentId ? filtered.findIndex((r) => r.id === currentId) : -1;
      const next = filtered[idx + 1] ?? filtered[0];
      if (!next) {
        setFocusedId(null);
        return;
      }
      setFocusedId(next.id);
      requestAnimationFrame(() => {
        inputRefs.current.get(next.id)?.focus();
      });
    },
    [filtered],
  );

  const renderFilterSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: DisplayInventoryFilterOption[],
    allLabel: string,
  ) => (
    <div className="min-w-0 flex-1 space-y-1">
      <span className="block px-1 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={(v) => onChange(String(v))}>
        <SelectTrigger className={filterSelectClass}>
          <SelectValue>
            {value === ALL
              ? "Alle"
              : (options.find((o) => o.id === value)?.name ?? allLabel)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const exportInitialFilters = useMemo(
    () => ({
      supplierId: filterSupplier,
      categoryId: filterCategory,
      productionSiteId: filterProduction,
    }),
    [filterCategory, filterProduction, filterSupplier],
  );

  if (!data && !loading) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Keine Bestandsdaten verfügbar.
      </p>
    );
  }

  return (
    <div className={displayModuleContentClassName}>
      <div data-inventory-toolbar className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("stock");
            setFocusedId(null);
          }}
          className={cn(
            "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-base font-medium transition-colors sm:flex-none sm:px-8",
            mode === "stock"
              ? "border-accent bg-accent/15 text-accent"
              : "border-border/50 bg-card hover:bg-muted/40",
          )}
        >
          <Package className="size-5 shrink-0" aria-hidden />
          Bestand
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("order");
            setFocusedId(null);
          }}
          className={cn(
            "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-base font-medium transition-colors sm:flex-none sm:px-8",
            mode === "order"
              ? "border-accent bg-accent/15 text-accent"
              : "border-border/50 bg-card hover:bg-muted/40",
          )}
        >
          <ShoppingCart className="size-5 shrink-0" aria-hidden />
          Bestellung
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            reservationsDayDrawerHeaderActionButtonClassName,
            "ml-auto size-12 rounded-2xl",
          )}
          aria-label={
            mode === "stock" ? "Bestand exportieren" : "Bestellung exportieren"
          }
          disabled={showDataSkeleton || !data || data.ingredients.length === 0}
          onClick={() => setExportOpen(true)}
        >
          <Download className="size-5" />
        </Button>
      </div>

      {showDataSkeleton ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-16 flex-1 rounded-2xl" />
            <Skeleton className="h-16 flex-1 rounded-2xl" />
            <Skeleton className="h-16 flex-1 rounded-2xl" />
          </div>
          <Skeleton className="h-11 w-full rounded-2xl" />
          <div
            className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            aria-busy
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="min-h-[10.5rem] rounded-3xl" />
            ))}
          </div>
        </>
      ) : data ? (
        <>
      <div
        data-inventory-toolbar
        className="flex flex-col gap-3 sm:flex-row"
      >
        {renderFilterSelect(
          "Produktionsstelle",
          filterProduction,
          setFilterProduction,
          data.productionSites,
          "Alle Produktionsstellen",
        )}
        {renderFilterSelect(
          "Lieferant",
          filterSupplier,
          setFilterSupplier,
          data.suppliers,
          "Alle Lieferanten",
        )}
        {renderFilterSelect(
          "Kategorie",
          filterCategory,
          setFilterCategory,
          data.categories,
          "Alle Kategorien",
        )}
      </div>

      <div data-inventory-toolbar className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocusedId(null)}
          placeholder="Zutat suchen …"
          className="h-12 rounded-2xl border-input bg-card pl-12 text-base"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} Zutaten
        {mode === "stock"
          ? " — Karte antippen, Bestand eingeben; Tab oder Enter für die nächste Zutat."
          : " — Karte antippen, Bestellmenge eingeben; Tab oder Enter für die nächste Zutat."}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/50 py-12 text-center text-muted-foreground">
          Keine Zutaten für die aktuelle Filterung.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((row) => (
            <DisplayInventoryCard
              key={row.id}
              row={row}
              mode={mode}
              focused={focusedId === row.id}
              onFocusRequest={() => setFocusedId(row.id)}
              onReleaseFocus={() => setFocusedId(null)}
              onAdvance={focusNextAfter}
              onCommitted={(committedId, patch) => {
                if (committedId && patch) {
                  setData((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      ingredients: prev.ingredients.map((ing) =>
                        ing.id === committedId ? { ...ing, ...patch } : ing,
                      ),
                    };
                  });
                }
              }}
              registerInput={registerInput}
            />
          ))}
        </div>
      )}
        </>
      ) : null}

      {data ? (
        <DisplayInventoryExportSheet
          open={exportOpen}
          onOpenChange={setExportOpen}
          mode={mode}
          ingredients={data.ingredients}
          suppliers={data.suppliers}
          categories={data.categories}
          productionSites={data.productionSites}
          restaurantName={restaurantName}
          initialFilters={exportInitialFilters}
        />
      ) : null}
    </div>
  );
}
