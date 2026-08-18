export const EVENT_PACKAGE_KINDS = ["buffet", "drinks", "extra"] as const;

export type EventPackageKind = (typeof EVENT_PACKAGE_KINDS)[number];

export type EventPackage = {
  id: string;
  restaurantId: string;
  kind: EventPackageKind;
  name: string;
  description: string;
  pricePerPerson: number;
  taxRatePercent: number;
  active: boolean;
  sortOrder: number;
};

export type PublicEventPackage = Pick<
  EventPackage,
  "id" | "kind" | "name" | "description" | "pricePerPerson"
>;

export const EVENT_PACKAGE_KIND_ORDER: Record<EventPackageKind, number> = {
  buffet: 0,
  drinks: 1,
  extra: 2,
};

export const EVENT_PACKAGE_KIND_LABELS: Record<EventPackageKind, string> = {
  buffet: "Buffet",
  drinks: "Getränke",
  extra: "Extras",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEventPackageKind(value: string): value is EventPackageKind {
  return (EVENT_PACKAGE_KINDS as readonly string[]).includes(value);
}

export function isEventPackageId(value: string): boolean {
  return UUID_RE.test(value);
}

export function parseEventPackageMoney(value: unknown): number {
  const raw =
    typeof value === "number"
      ? String(value)
      : String(value ?? "").trim().replace(",", ".");
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function eventPackageEstimateTotal(
  packages: ReadonlyArray<Pick<EventPackage, "pricePerPerson">>,
  partySize: number,
): number {
  const perPerson = packages.reduce((sum, pkg) => sum + pkg.pricePerPerson, 0);
  const people = Number.isFinite(partySize) ? Math.max(0, partySize) : 0;
  return Math.round(perPerson * people * 100) / 100;
}

export function sortEventPackages<T extends Pick<EventPackage, "kind" | "sortOrder" | "name">>(
  packages: T[],
): T[] {
  return [...packages].sort((a, b) => {
    const kindDelta =
      EVENT_PACKAGE_KIND_ORDER[a.kind] - EVENT_PACKAGE_KIND_ORDER[b.kind];
    if (kindDelta !== 0) return kindDelta;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, "de");
  });
}

export type EventPackageWriteFields = {
  kind: EventPackageKind;
  name: string;
  description: string;
  pricePerPerson: number;
  taxRatePercent: number;
  active: boolean;
  sortOrder: number;
};

export function parseEventPackageWriteFields(
  body: Record<string, unknown>,
): { error: string } | { error: null; input: EventPackageWriteFields } {
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!isEventPackageKind(kind)) return { error: "invalid_kind" };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 120) return { error: "invalid_name" };
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 500) return { error: "invalid_description" };
  const pricePerPerson = parseEventPackageMoney(
    body.pricePerPerson ?? body.price_per_person,
  );
  if (pricePerPerson < 0 || pricePerPerson > 9999.99) return { error: "invalid_price" };
  const taxRatePercent = parseEventPackageMoney(
    body.taxRatePercent ?? body.tax_rate_percent ?? 19,
  );
  if (taxRatePercent < 0 || taxRatePercent > 100) return { error: "invalid_tax_rate" };
  const sortOrder = Number.isFinite(Number(body.sortOrder ?? body.sort_order))
    ? Math.trunc(Number(body.sortOrder ?? body.sort_order))
    : 0;
  return {
    error: null,
    input: {
      kind,
      name,
      description,
      pricePerPerson,
      taxRatePercent,
      active: body.active !== false,
      sortOrder,
    },
  };
}
