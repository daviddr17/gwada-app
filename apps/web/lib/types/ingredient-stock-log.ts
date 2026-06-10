import type { OrderProtocolActor, ProtocolUserSource } from "@/lib/types/purchase-order";
import { formatOrderProtocolUserName } from "@/lib/types/purchase-order";

/** Manuelle Bestandsänderung in der Übersicht (oder sonst ohne Lieferbezug). */
export type IngredientStockLogManual = {
  id: string;
  at: string;
  userFirstName: string;
  userLastName: string;
  userSource?: ProtocolUserSource;
  kind: "manual_stock";
  fromQuantity: number;
  toQuantity: number;
  unitId: string;
  unitLabel: string;
};

/** Bestandserhöhung durch „als geliefert markiert“ aus abgeschlossener Bestellung. */
export type IngredientStockLogFromDelivery = {
  id: string;
  at: string;
  userFirstName: string;
  userLastName: string;
  userSource?: ProtocolUserSource;
  kind: "stock_from_delivery";
  fromQuantity: number;
  toQuantity: number;
  unitId: string;
  unitLabel: string;
  orderId: string;
  supplierName: string;
};

/** Rücknahme der Lieferbuchung (Bestand wird reduziert). */
export type IngredientStockLogDeliveryReverted = {
  id: string;
  at: string;
  userFirstName: string;
  userLastName: string;
  userSource?: ProtocolUserSource;
  kind: "stock_delivery_reverted";
  fromQuantity: number;
  toQuantity: number;
  unitId: string;
  unitLabel: string;
  orderId: string;
  supplierName: string;
};

/** Bestandsreduktion durch Rechnung (Artikel mit Rezept). */
export type IngredientStockLogFromInvoice = {
  id: string;
  at: string;
  userFirstName: string;
  userLastName: string;
  userSource?: ProtocolUserSource;
  kind: "stock_from_invoice";
  fromQuantity: number;
  toQuantity: number;
  unitId: string;
  unitLabel: string;
  invoiceId: string;
  voucherNumber: string | null;
  articleName: string;
};

/** Bestandserhöhung durch Rechnungskorrektur (Gegenbuchung zum Rechnungsabzug). */
export type IngredientStockLogFromInvoiceCorrection = {
  id: string;
  at: string;
  userFirstName: string;
  userLastName: string;
  userSource?: ProtocolUserSource;
  kind: "stock_from_invoice_correction";
  fromQuantity: number;
  toQuantity: number;
  unitId: string;
  unitLabel: string;
  invoiceId: string;
  correctsInvoiceId: string;
  voucherNumber: string | null;
  originalVoucherNumber: string | null;
  articleName: string;
};

export type IngredientStockLogEntry =
  | IngredientStockLogManual
  | IngredientStockLogFromDelivery
  | IngredientStockLogDeliveryReverted
  | IngredientStockLogFromInvoice
  | IngredientStockLogFromInvoiceCorrection;

export function resolveIngredientStockLogUserLabel(
  e: IngredientStockLogEntry,
  currentProfile: OrderProtocolActor,
): string {
  if (e.userSource === "local_profile") {
    return formatOrderProtocolUserName(currentProfile) || "—";
  }
  return (
    formatOrderProtocolUserName({
      firstName: e.userFirstName,
      lastName: e.userLastName,
    }) || "—"
  );
}

export function ingredientStockActionColumn(e: IngredientStockLogEntry): string {
  switch (e.kind) {
    case "manual_stock":
      return "Menge geändert";
    case "stock_from_delivery":
      return "Geliefert markiert";
    case "stock_delivery_reverted":
      return "Geliefert rückgängig";
    case "stock_from_invoice":
      return "Rechnung";
    case "stock_from_invoice_correction":
      return "Rechnungskorrektur";
    default:
      return "—";
  }
}
