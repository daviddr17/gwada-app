export type PurchaseOrderStatus = "open" | "ordered" | "closed";

/** Liefer-Antwort pro Position (nach „Bestellt“). */
export type PurchaseOrderLineDeliveryStatus =
  | "delivered"
  | "not_delivered"
  | "partial";

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

/** Liefer-Antwort gesetzt/geändert (Bestand wird separat angepasst). */
export type PurchaseOrderLogMarkedDelivered = {
  id: string;
  at: string;
  userFirstName: string;
  userLastName: string;
  userSource?: ProtocolUserSource;
  kind: "marked_delivered";
  ingredientId: string;
  ingredientName: string;
  /** Bestandswirksame Menge (0 bei nicht geliefert). */
  quantity: number;
  unitId: string;
  unitLabel: string;
  lineId: string;
  deliveryStatus?: PurchaseOrderLineDeliveryStatus;
  note?: string;
};

/** Liefer-Antwort zurückgesetzt (Bestand wird separat reduziert). */
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

/** Statuswechsel Offen ↔ Bestellt ↔ Abgeschlossen. */
export type PurchaseOrderLogStatusChange = {
  id: string;
  at: string;
  userFirstName: string;
  userLastName: string;
  userSource?: ProtocolUserSource;
  kind: "status_change";
  fromStatus: PurchaseOrderStatus;
  toStatus: PurchaseOrderStatus;
  /** Dummy für gemeinsame Protokoll-Felder (keine Zutat). */
  ingredientId: string;
  ingredientName: string;
  unitId: string;
  unitLabel: string;
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
  | PurchaseOrderLogStatusChange
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
  /** Zeitpunkt der Liefer-Antwort */
  deliveredAt?: string;
  /** Geliefert / nicht geliefert / abweichend — Legacy: nur deliveredAt = geliefert */
  deliveryStatus?: PurchaseOrderLineDeliveryStatus;
  /** Gelieferte Menge (bei abweichend / optional bei geliefert) */
  deliveredQuantity?: number;
  /** Optional bei nicht geliefert / abweichend */
  deliveryNote?: string;
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
 * Klarname aus dem ältesten Protokolleintrag mit gespeichertem Namen.
 * (Bei `local_profile` ohne eingefrorene Namen war der Viewer fälschlich der „Ersteller“.)
 */
export function resolveCreatorLabelFromOrderLog(
  log: readonly PurchaseOrderLogEntry[],
): string {
  const chronological = [...log].sort((a, b) => a.at.localeCompare(b.at));
  for (const e of chronological) {
    const label = resolveLogEntryUserLabel(e);
    if (label && label !== "—") return label;
  }
  return "";
}

/**
 * Ersteller-Zeile: nur eingefrorene Klarnamen bzw. Protokoll — nie der aktuelle Betrachter.
 * `createdByUserSource: local_profile` war Single-Device-Remapping und ist unzuverlässig
 * (zeigte Admin/David statt Mitarbeitende).
 */
export function resolveProtocolCreatorLabel(
  order: Pick<PurchaseOrder, "createdBy" | "createdByUserSource" | "log">,
  _currentProfile?: OrderProtocolActor,
): string {
  const fromLog = resolveCreatorLabelFromOrderLog(order.log ?? []);
  // local_profile: eingefrorener Text kann vom Viewer-Remapping stammen → Protokoll bevorzugen
  if (order.createdByUserSource === "local_profile") {
    return fromLog;
  }
  const frozen = order.createdBy.trim();
  if (frozen && frozen !== "—") return frozen;
  return fromLog;
}

export function resolveLogEntryUserLabel(
  e: PurchaseOrderLogEntry,
  _currentProfile?: OrderProtocolActor,
): string {
  switch (e.kind) {
    case "add_to_order":
    case "quantity_change":
    case "marked_delivered":
    case "delivery_reverted":
    case "status_change": {
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

/**
 * Entfernt unzuverlässiges `local_profile`-Remapping und setzt `createdBy`
 * aus dem Protokoll, wenn dort ein Klarname liegt.
 */
export function healPurchaseOrderCreatorAttribution(order: PurchaseOrder): PurchaseOrder {
  if (order.createdByUserSource !== "local_profile") return order;
  const fromLog = resolveCreatorLabelFromOrderLog(order.log);
  return {
    ...order,
    createdBy: fromLog,
    createdByUserSource: undefined,
  };
}

export function healPurchaseOrdersCreatorAttribution(
  orders: PurchaseOrder[],
): { orders: PurchaseOrder[]; changed: boolean } {
  let changed = false;
  const next = orders.map((order) => {
    const healed = healPurchaseOrderCreatorAttribution(order);
    if (
      healed.createdBy !== order.createdBy ||
      healed.createdByUserSource !== order.createdByUserSource
    ) {
      changed = true;
    }
    return healed;
  });
  return { orders: next, changed };
}

export type PurchaseOrdersPersistenceV1 = {
  version: 1;
  orders: PurchaseOrder[];
};
