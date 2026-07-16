/** Wohin eine Speisekarten-Kategorie beim Bestellen geroutet wird. */
export const POS_ROUTE_DESTINATIONS = [
  "kds",
  "printer",
  "both",
  "none",
] as const;

export type PosRouteDestination = (typeof POS_ROUTE_DESTINATIONS)[number];

export const POS_ROUTE_DESTINATION_LABELS_DE: Record<
  PosRouteDestination,
  string
> = {
  kds: "Nur KDS",
  printer: "Nur Drucker",
  both: "KDS + Drucker",
  none: "Kein Küchen-Bon",
};

export function isPosRouteDestination(
  value: unknown,
): value is PosRouteDestination {
  return (
    typeof value === "string" &&
    (POS_ROUTE_DESTINATIONS as readonly string[]).includes(value)
  );
}

/** Default ohne gespeicherte Route: klassisches KDS-Verhalten. */
export const DEFAULT_POS_ROUTE_DESTINATION: PosRouteDestination = "kds";

export function routeIncludesKds(destination: PosRouteDestination): boolean {
  return destination === "kds" || destination === "both";
}

export function routeIncludesPrinter(
  destination: PosRouteDestination,
): boolean {
  return destination === "printer" || destination === "both";
}

export const POS_PRINTER_CONNECTION_TYPES = [
  "virtual",
  "network",
  "bluetooth",
  "usb",
  "airprint",
] as const;

export type PosPrinterConnectionType =
  (typeof POS_PRINTER_CONNECTION_TYPES)[number];

export const POS_PRINTER_CONNECTION_LABELS_DE: Record<
  PosPrinterConnectionType,
  string
> = {
  virtual: "Virtuell (Queue)",
  network: "Netzwerk (TCP)",
  bluetooth: "Bluetooth",
  usb: "USB",
  airprint: "AirPrint",
};

export function isPosPrinterConnectionType(
  value: unknown,
): value is PosPrinterConnectionType {
  return (
    typeof value === "string" &&
    (POS_PRINTER_CONNECTION_TYPES as readonly string[]).includes(value)
  );
}
