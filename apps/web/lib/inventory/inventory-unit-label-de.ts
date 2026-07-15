import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";

/** Bekannte englische Lagereinheiten → Deutsch (App ist derzeit einsprachig). */
const INVENTORY_UNIT_LABEL_DE: Record<string, string> = {
  piece: "Stück",
  pieces: "Stück",
  pcs: "Stück",
  pc: "Stück",
  stk: "Stück",
  stück: "Stück",
  package: "Packung",
  packages: "Packungen",
  pkg: "Packung",
  pkgs: "Packungen",
  pack: "Packung",
  packs: "Packungen",
  gram: "Gramm",
  grams: "Gramm",
  g: "Gramm (g)",
  kilogram: "Kilogramm",
  kilograms: "Kilogramm",
  kg: "Kilogramm (kg)",
  liter: "Liter",
  litres: "Liter",
  litre: "Liter",
  l: "Liter (l)",
  milliliter: "Milliliter",
  milliliters: "Milliliter",
  millilitre: "Milliliter",
  millilitres: "Milliliter",
  ml: "Milliliter (ml)",
  bottle: "Flasche",
  bottles: "Flaschen",
  can: "Dose",
  cans: "Dosen",
  box: "Karton",
  boxes: "Kartons",
  bag: "Beutel",
  bags: "Beutel",
  sack: "Sack",
  sacks: "Säcke",
  crate: "Kiste",
  crates: "Kisten",
  tray: "Tablett",
  trays: "Tabletts",
  portion: "Portion",
  portions: "Portionen",
  unit: "Einheit",
  units: "Einheiten",
};

function normalizeInventoryUnitKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function translateInventoryUnitToken(value: string): string | null {
  const key = normalizeInventoryUnitKey(value);
  if (!key) return null;
  return INVENTORY_UNIT_LABEL_DE[key] ?? null;
}

/**
 * Liefert die deutschsprachige Anzeige einer Lagereinheit.
 * Taxonomie-Namen aus der DB haben Vorrang, sofern sie nicht bekannte Englisch-IDs sind.
 */
export function inventoryUnitLabelDe(
  unitId: string,
  unitLabel?: string | null,
): string {
  const id = unitId.trim();
  const label = unitLabel?.trim() ?? "";

  if (label) {
    const translatedLabel = translateInventoryUnitToken(label);
    if (translatedLabel) return translatedLabel;
    if (translateInventoryUnitToken(id) === null || label !== id) {
      return label;
    }
  }

  const translatedId = translateInventoryUnitToken(id);
  if (translatedId) return translatedId;

  return label || id;
}

/**
 * Einheit für UI/Export: Taxonomie-Name + deutsche Übersetzung bekannter IDs.
 * `storedLabel` dient als Fallback für ältere Bestell-/Protokoll-Snapshots.
 */
export function resolveInventoryUnitDisplayLabel(
  unitId: string,
  units: readonly InventoryTaxonomyDefinition[],
  storedLabel?: string | null,
): string {
  const unitDef = units.find((u) => u.id === unitId);
  const label = inventoryUnitLabelDe(
    unitId,
    unitDef?.name ?? storedLabel ?? undefined,
  );
  if (unitDef?.active === false) return `${label} · inaktiv`;
  return label;
}
