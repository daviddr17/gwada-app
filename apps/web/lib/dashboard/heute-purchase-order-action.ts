/** Heute-Zeile für einen echten Bestellstatus. Gelb = offen, Blau = bestellt. */

export type HeutePurchaseOrderActionTone = "warning" | "attention";

export type HeutePurchaseOrderAction = {
  id: string;
  title: string;
  tone: HeutePurchaseOrderActionTone;
};

function pluralDe(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function heutePurchaseOrderActions(counts: {
  ordersOpen: number;
  ordersOrdered: number;
}): HeutePurchaseOrderAction[] {
  const items: HeutePurchaseOrderAction[] = [];
  const open = Math.max(0, counts.ordersOpen);
  const ordered = Math.max(0, counts.ordersOrdered);

  if (open > 0) {
    items.push({
      id: "inventory-orders-open",
      title: `${open} ${pluralDe(open, "Bestellung offen", "Bestellungen offen")}`,
      tone: "warning",
    });
  }
  if (ordered > 0) {
    items.push({
      id: "inventory-orders-ordered",
      title: `${ordered} ${pluralDe(
        ordered,
        "Bestellung bestellt",
        "Bestellungen bestellt",
      )}`,
      tone: "attention",
    });
  }
  return items;
}
