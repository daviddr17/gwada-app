export type PurchaseOrderStatus = "open" | "closed";

/** Nutzer für Protokoll (Vor- und Nachname getrennt). */
export type OrderProtocolActor = {
  firstName: string;
  lastName: string;
};

/** @deprecated Legacy Single-Device-Hinweis; Anzeige nutzt eingefrorene Namen. */
export type ProtocolUserSource = "local_profile";

export function formatOrderProtocolUserName(actor: OrderProtocolActor): string {
  return `${actor.firstName.trim()} ${actor.lastName.trim()}`.trim();
}

/** Vor-/Nachname zum Einfrieren in Protokoll-Einträgen (kein `local_profile`-Remapping). */
export function protocolActorNameFields(actor: OrderProtocolActor): {
  userFirstName: string;
  userLastName: string;
} {
  return {
    userFirstName: actor.firstName.trim(),
    userLastName: actor.lastName.trim(),
  };
}

/** Ersteller-Text für Bestellkopf — Klarname zum Zeitpunkt der Aktion. */
export function protocolCreatedByLabel(actor: OrderProtocolActor): string {
  return formatOrderProtocolUserName(actor) || "—";
}

/** Neues Protokoll: Artikel zur Bestellung hinzugefügt. */
export type PurchaseOrderLogAdd = {
  id: string;
  at: string;
  userFirstName: string;
  userLastName: string;
  /** Wenn gesetzt, Namen bei Anzeige aus dem persönlichen Profil (nicht aus den Textfeldern). */
  userSource?: ProtocolUserSource;
  kind: "add_to_order";
  ingredientId: string;
  ingredientName: string;
  /** In dieser Aktion hinzugefügte Menge */
  quantity: number;
  unitId: string;
  unitLabel: string;
};

/** Neues Protokoll: Menge angepasst (inkl. Entfernen bei Ziel 0). */
export type PurchaseOrderLogQuantityChange = {
  id: string;
  at: string;
  userFirstName: string;
  userLastName: string;
  userSource?: ProtocolUserSource;
  kind: "quantity_change";
  ingredientId: string;
  ingredientName: string;
  fromQuantity: number;
  toQuantity: number;
  unitId: string;
  unitLabel: string;
};

/** Abgeschlossene Bestellung: Position als geliefert markiert (Bestand wird separat erhöht). */
export type PurchaseOrderLogMarkedDelivered = {
  id: string;
  at: string;
  userFirstName: string;
  userLastName: string;
  userSource?: ProtocolUserSource;
  kind: "marked_delivered";
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unitId: string;
  unitLabel: string;
  lineId: string;
};

/** Abgeschlossene Bestellung: Liefermarkierung wieder aufgehoben (Bestand wird separat reduziert). */
export type PurchaseOrderLogDeliveryReverted = {
  id: string;
  at: string;
  userFirstName: string;
  userLastName: string;
  userSource?: ProtocolUserSource;
  kind: "delivery_reverted";
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unitId: string;
  unitLabel: string;
  lineId: string;
};

/** Alte Einträge (nur Δ, ein Namensfeld). */
export type PurchaseOrderLogLegacy = {
  id: string;
  at: string;
  userName: string;
  kind: "legacy_adjustment";
  ingredientId: string;
  ingredientName: string;
  quantityDelta: number;
  unitId: string;
  unitLabel: string;
};

export type PurchaseOrderLogEntry =
  | PurchaseOrderLogAdd
  | PurchaseOrderLogQuantityChange
  | PurchaseOrderLogMarkedDelivered
  | PurchaseOrderLogDeliveryReverted
  | PurchaseOrderLogLegacy;

/** Aggregierte Position in der Bestellung (gleiche Zutat wird summiert). */
export type PurchaseOrderLine = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  /** Anzeigename Marke (Stammdaten zum Zeitpunkt der Zuordnung / letzter Ergänzung) */
  brandLabel?: string;
  quantity: number;
  unitId: string;
  unitLabel: string;
  /** Wenn gesetzt: Position aus abgeschlossener Bestellung als geliefert gebucht */
  deliveredAt?: string;
};

export type PurchaseOrder = {
  id: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  /** Erstellungszeitpunkt – unveränderlich */
  createdAt: string;
  /** Klarname zum Zeitpunkt der Eröffnung (eingefroren). */
  createdBy: string;
  /** @deprecated Nicht mehr für Remapping nutzen — `createdBy` ist Source of Truth. */
  createdByUserSource?: ProtocolUserSource;
  /** Geplantes Lieferdatum (YYYY-MM-DD), optional */
  deliveryDate: string | null;
  lines: PurchaseOrderLine[];
  log: PurchaseOrderLogEntry[];
};

/**
 * Ersteller-Zeile: immer der eingefrorene Klarname.
 * `createdByUserSource: local_profile` war Single-Device-Remapping und zeigte fälschlich
 * den aktuellen Betrachter (z. B. Admin) statt den Mitarbeitenden.
 */
export function resolveProtocolCreatorLabel(
  order: Pick<PurchaseOrder, "createdBy" | "createdByUserSource">,
  _currentProfile?: OrderProtocolActor,
): string {
  const frozen = order.createdBy.trim();
  if (frozen) return frozen;
  return "—";
}

export function resolveLogEntryUserLabel(
  e: PurchaseOrderLogEntry,
  _currentProfile?: OrderProtocolActor,
): string {
  switch (e.kind) {
    case "add_to_order":
    case "quantity_change":
    case "marked_delivered":
    case "delivery_reverted": {
      const stored = formatOrderProtocolUserName({
        firstName: e.userFirstName,
        lastName: e.userLastName,
      });
      if (stored) return stored;
      return "—";
    }
    case "legacy_adjustment":
      return e.userName.trim() || "—";
    default:
      return "—";
  }
}

export type PurchaseOrdersPersistenceV1 = {
  version: 1;
  orders: PurchaseOrder[];
};
