"use client";

import { ChevronDown, ClipboardList } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { OrderProtocolDrawer } from "@/components/inventory/order-protocol-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePersonalProfileNames } from "@/lib/hooks/use-personal-profile-names";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { usePurchaseOrdersStorage } from "@/lib/hooks/use-purchase-orders-storage";
import {
  type OrderProtocolActor,
  type PurchaseOrder,
  type PurchaseOrderLine,
  resolveProtocolCreatorLabel,
} from "@/lib/types/purchase-order";
import { cn } from "@/lib/utils";

const scopeItems = {
  active: "Aktive Bestellungen",
  past: "Vergangene Bestellungen",
} as const;

const df = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatWhen(iso: string) {
  try {
    return df.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDeliveryYmd(ymd: string | null) {
  if (!ymd) return null;
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
      new Date(`${ymd}T12:00:00`),
    );
  } catch {
    return ymd;
  }
}

const orderQtyInputClass =
  "h-9 w-full min-w-[4.5rem] rounded-xl border border-input bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function OrderLineQtyCell({
  orderId,
  line,
  readOnly,
  actor,
  onCommit,
}: {
  orderId: string;
  line: PurchaseOrderLine;
  readOnly: boolean;
  actor: OrderProtocolActor;
  onCommit: (
    orderId: string,
    lineId: string,
    qty: number,
    user: OrderProtocolActor,
  ) => boolean;
}) {
  const [draft, setDraft] = useState(() => String(line.quantity));

  useEffect(() => {
    setDraft(String(line.quantity));
  }, [line.quantity]);

  const commit = useCallback(() => {
    if (readOnly) return;
    const q = Number.parseFloat(draft.replace(",", "."));
    if (Number.isNaN(q) || q < 0) {
      toast.error("Bitte eine gültige Menge (≥ 0) eingeben.");
      setDraft(String(line.quantity));
      return;
    }
    onCommit(orderId, line.id, q, actor);
  }, [draft, line.id, line.quantity, onCommit, orderId, readOnly, actor]);

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={readOnly}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(
        orderQtyInputClass,
        "text-right",
        readOnly && "cursor-not-allowed opacity-60",
      )}
      aria-label={`Menge ${line.ingredientName}`}
    />
  );
}

export function PurchaseOrdersScreen() {
  const { actor, isHydrated: userNameHydrated } = usePersonalProfileNames();
  const {
    orders,
    isHydrated,
    closeOrder,
    reopenOrder,
    setOrderDeliveryDate,
    updateLineQuantity,
    markLineDelivered,
    unmarkLineDelivered,
  } = usePurchaseOrdersStorage();
  const {
    ingredients,
    updateIngredient,
    isHydrated: ingredientsHydrated,
  } = useIngredientsStorage();
  const [scope, setScope] = useState<keyof typeof scopeItems>("active");
  const [supplierFilterId, setSupplierFilterId] = useState<string>("all");
  const [protocolOrderId, setProtocolOrderId] = useState<string | null>(null);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const protocolOrder = useMemo(
    () => (protocolOrderId ? orders.find((o) => o.id === protocolOrderId) ?? null : null),
    [orders, protocolOrderId],
  );

  const supplierFilterOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const o of orders) {
      byId.set(o.supplierId, o.supplierName);
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "de"))
      .map(([value, label]) => ({ value, label }));
  }, [orders]);

  useEffect(() => {
    if (supplierFilterId === "all") return;
    if (!supplierFilterOptions.some((o) => o.value === supplierFilterId)) {
      setSupplierFilterId("all");
    }
  }, [supplierFilterId, supplierFilterOptions]);

  const filtered = useMemo(() => {
    return orders
      .filter((o) => (scope === "active" ? o.status === "open" : o.status === "closed"))
      .filter((o) => supplierFilterId === "all" || o.supplierId === supplierFilterId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, scope, supplierFilterId]);

  const ready = isHydrated && userNameHydrated && ingredientsHydrated;

  const openProtocol = (o: PurchaseOrder) => {
    setProtocolOrderId(o.id);
    setProtocolOpen(true);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  };

  const commitLineQty = useCallback(
    (orderId: string, lineId: string, qty: number, user: OrderProtocolActor) =>
      updateLineQuantity(orderId, lineId, qty, user),
    [updateLineQuantity],
  );

  const handleMarkLineDelivered = useCallback(
    (orderId: string, lineId: string) => {
      const order = orders.find((o) => o.id === orderId);
      const line = order?.lines.find((l) => l.id === lineId);
      const ing = line ? ingredients.find((i) => i.id === line.ingredientId) : undefined;
      if (!order || order.status !== "closed" || !line || line.deliveredAt) return;
      if (!ing) {
        toast.error("Zutat nicht gefunden – Bestand kann nicht erhöht werden.");
        return;
      }
      const newStock = ing.currentStock + line.quantity;
      const okStock = updateIngredient(ing.id, { currentStock: newStock }, {
        stockActor: actor,
        stockUnitLabel: line.unitLabel,
        stockFromDelivery: { orderId: order.id, supplierName: order.supplierName },
      });
      if (!okStock) {
        toast.error("Bestand konnte nicht gespeichert werden.");
        return;
      }
      if (!markLineDelivered(orderId, lineId)) {
        updateIngredient(ing.id, { currentStock: ing.currentStock }, { skipStockLog: true });
        toast.error(
          "Bestellung konnte nicht aktualisiert werden. Bestand wurde zurückgesetzt.",
        );
        return;
      }
      toast.success(
        `„${line.ingredientName}“ als geliefert markiert – Bestand um ${line.quantity} ${line.unitLabel} erhöht.`,
      );
    },
    [actor, ingredients, markLineDelivered, orders, updateIngredient],
  );

  const handleUnmarkLineDelivered = useCallback(
    (orderId: string, lineId: string) => {
      const order = orders.find((o) => o.id === orderId);
      const line = order?.lines.find((l) => l.id === lineId);
      const ing = line ? ingredients.find((i) => i.id === line.ingredientId) : undefined;
      if (!order || order.status !== "closed" || !line || !line.deliveredAt) return;
      if (!ing) {
        toast.error("Zutat nicht gefunden – Bestand kann nicht angepasst werden.");
        return;
      }
      const newStock = ing.currentStock - line.quantity;
      if (newStock < 0) {
        toast.error(
          "Rückgängig nicht möglich: Bestand reicht für diese Menge nicht aus.",
        );
        return;
      }
      const okStock = updateIngredient(ing.id, { currentStock: newStock }, {
        stockActor: actor,
        stockUnitLabel: line.unitLabel,
        stockDeliveryRevert: { orderId: order.id, supplierName: order.supplierName },
      });
      if (!okStock) {
        toast.error("Bestand konnte nicht gespeichert werden.");
        return;
      }
      if (!unmarkLineDelivered(orderId, lineId)) {
        updateIngredient(ing.id, { currentStock: ing.currentStock }, { skipStockLog: true });
        toast.error(
          "Bestellung konnte nicht aktualisiert werden. Bestand wurde zurückgesetzt.",
        );
        return;
      }
      toast.success(
        `Lieferung von „${line.ingredientName}“ rückgängig – Bestand um ${line.quantity} ${line.unitLabel} reduziert.`,
      );
    },
    [actor, ingredients, orders, unmarkLineDelivered, updateIngredient],
  );

  return (
    <div
      className={cn(
        "transition-opacity duration-300",
        !ready && "opacity-0",
        ready && "opacity-100",
      )}
    >
      <p className="mb-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Lieferantenbestellungen mit Positionen und Protokoll. Bei abgeschlossenen
        Bestellungen kannst du Positionen als geliefert markieren – der Lagerbestand
        wird erhöht und sowohl im Bestell- als auch im Bestandsprotokoll erfasst. Markierung
        ist wieder aufhebbar („Geliefert rückgängig“) mit Bestandskorrektur und Protokoll.
        Mengen und Lieferdatum sind bei offenen Bestellungen direkt in der Tabelle
        änderbar. Klicke auf eine Zeile, um Details einzublenden.
      </p>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="size-4 shrink-0 opacity-80" aria-hidden />
          <span>{filtered.length} Bestellung{filtered.length === 1 ? "" : "en"}</span>
        </div>
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:max-w-2xl sm:flex-row sm:justify-end">
          <SearchableSelect
            options={[
              { value: "all", label: "Alle Lieferanten" },
              ...supplierFilterOptions,
            ]}
            value={supplierFilterId}
            onValueChange={setSupplierFilterId}
            placeholder="Lieferant"
            searchPlaceholder="Lieferant suchen…"
            aria-label="Nach Lieferant filtern"
            className="h-11 w-full min-w-0 rounded-2xl sm:min-w-[12rem] sm:max-w-[14rem]"
          />
          <Select
            value={scope}
            items={scopeItems}
            onValueChange={(v) => {
              if (v === "active" || v === "past") setScope(v);
            }}
          >
            <SelectTrigger className="h-11 w-full min-w-0 rounded-2xl sm:min-w-[14rem] sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{scopeItems.active}</SelectItem>
              <SelectItem value="past">{scopeItems.past}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-14 text-center">
          <p className="text-base font-medium text-foreground">
            {scope === "active"
              ? "Keine aktiven Bestellungen"
              : "Keine vergangenen Bestellungen"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {scope === "active"
              ? "Lege über die Übersicht mit dem Feld „Bestellung“ Mengen fest – es wird automatisch eine offene Bestellung je Lieferant geführt."
              : "Abgeschlossene Bestellungen erscheinen hier."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const isExpanded = Boolean(expanded[order.id]);
            const deliveryLabel = formatDeliveryYmd(order.deliveryDate);
            return (
              <section
                key={order.id}
                className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm"
              >
                <div className="flex min-h-[3.25rem] items-stretch gap-0">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-muted/30 sm:gap-3 sm:px-4"
                    onClick={() => toggleExpanded(order.id)}
                    aria-expanded={isExpanded}
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        isExpanded && "rotate-180",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold tracking-tight">
                          {order.supplierName}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            order.status === "open"
                              ? "bg-accent/15 text-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {order.status === "open" ? "Offen" : "Abgeschlossen"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {order.lines.length} Position{order.lines.length === 1 ? "" : "en"}
                        {deliveryLabel ? ` · Lieferung ${deliveryLabel}` : ""}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Erstellt {formatWhen(order.createdAt)} ·{" "}
                        {resolveProtocolCreatorLabel(order, actor)}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col justify-center gap-2 border-l border-border/50 px-2 py-2 sm:flex-row sm:items-center sm:px-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-border/60"
                      onClick={() => openProtocol(order)}
                    >
                      Protokoll
                    </Button>
                    {order.status === "open" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full bg-accent px-3 text-accent-foreground hover:bg-accent/90 sm:px-4"
                        onClick={() => closeOrder(order.id)}
                      >
                        Schließen
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-full px-3 sm:px-4"
                        onClick={() => {
                          if (reopenOrder(order.id)) {
                            setScope("active");
                          }
                        }}
                      >
                        Wieder öffnen
                      </Button>
                    )}
                  </div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-border/50">
                    <div className="flex flex-col gap-2 border-b border-border/40 bg-muted/20 px-4 py-3 sm:flex-row sm:items-end sm:gap-6 sm:px-5">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor={`delivery-${order.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Lieferdatum
                        </Label>
                        <Input
                          id={`delivery-${order.id}`}
                          type="date"
                          disabled={order.status !== "open"}
                          value={order.deliveryDate ?? ""}
                          onChange={(e) =>
                            setOrderDeliveryDate(order.id, e.target.value || null)
                          }
                          className="h-10 w-full max-w-[11.5rem] rounded-xl border-border/60 bg-card"
                        />
                      </div>
                      {order.status !== "open" ? (
                        <p className="text-xs text-muted-foreground sm:pb-2">
                          Lieferdatum ist bei abgeschlossenen Bestellungen schreibgeschützt.
                        </p>
                      ) : null}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[920px] text-sm">
                        <thead>
                          <tr className="border-b border-border/60 bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <th className="min-w-[12rem] px-3 py-2.5">Zutat</th>
                            <th className="min-w-[8rem] px-3 py-2.5 normal-case">
                              Marke
                            </th>
                            <th className="min-w-[6rem] px-3 py-2.5 text-right normal-case">
                              Bestand
                            </th>
                            <th className="w-36 px-3 py-2.5 text-right">Menge</th>
                            <th className="min-w-[8rem] px-3 py-2.5">Einheit</th>
                            <th className="min-w-[12rem] px-3 py-2.5 normal-case">
                              Lieferung
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.lines.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-4 py-8 text-center text-muted-foreground"
                              >
                                Noch keine Positionen.
                              </td>
                            </tr>
                          ) : (
                            order.lines.map((line) => {
                              const ingRow = ingredients.find((i) => i.id === line.ingredientId);
                              return (
                              <tr
                                key={line.id}
                                className="border-b border-border/40 last:border-0"
                              >
                                <td className="px-3 py-2 font-medium text-foreground">
                                  {line.ingredientName}
                                </td>
                                <td className="max-w-[10rem] truncate px-3 py-2 text-muted-foreground">
                                  {line.brandLabel ?? "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                                  {ingRow != null ? ingRow.currentStock : "—"}
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  <OrderLineQtyCell
                                    orderId={order.id}
                                    line={line}
                                    readOnly={order.status !== "open"}
                                    actor={actor}
                                    onCommit={commitLineQty}
                                  />
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {line.unitLabel}
                                </td>
                                <td className="px-3 py-2 align-middle">
                                  {order.status === "closed" ? (
                                    line.deliveredAt ? (
                                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                          Geliefert
                                        </span>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-8 w-fit rounded-full border-border/60 px-3 text-xs"
                                          onClick={() =>
                                            handleUnmarkLineDelivered(order.id, line.id)
                                          }
                                        >
                                          Geliefert rückgängig
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-full border-border/60 px-3 text-xs"
                                        onClick={() =>
                                          handleMarkLineDelivered(order.id, line.id)
                                        }
                                      >
                                        Als geliefert markieren
                                      </Button>
                                    )
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <OrderProtocolDrawer
        order={protocolOrder}
        open={protocolOpen}
        onOpenChange={(o) => {
          setProtocolOpen(o);
          if (!o) setProtocolOrderId(null);
        }}
      />
    </div>
  );
}
