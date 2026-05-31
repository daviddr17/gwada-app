import type { RestaurantStaffContractRow } from "@/lib/types/staff";

const OPEN_CONTRACT_END = "9999-12-31";

const contractDateDe = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** YYYY-MM-DD → lokales Datum für Anzeige (DD.MM.YYYY). */
export function formatStaffContractDateDe(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return contractDateDe.format(new Date(y, m - 1, d));
}

export function formatStaffContractEndDe(validTo: string | null): string {
  return validTo ? formatStaffContractDateDe(validTo) : "offen";
}

/** „Start 01.05.2026 · Ende 31.12.2026“ bzw. Ende offen */
export function formatStaffContractPeriodDe(
  validFrom: string,
  validTo: string | null,
): string {
  return `Start ${formatStaffContractDateDe(validFrom)} · Ende ${formatStaffContractEndDe(validTo)}`;
}

function contractRangeEnd(validTo: string | null): string {
  return validTo ?? OPEN_CONTRACT_END;
}

/** Prüft Überschneidung zweier Vertragszeiträume (inklusive Grenztage). */
export function staffContractPeriodsOverlap(
  fromA: string,
  toA: string | null,
  fromB: string,
  toB: string | null,
): boolean {
  const endA = contractRangeEnd(toA);
  const endB = contractRangeEnd(toB);
  return fromA <= endB && fromB <= endA;
}

export function findOverlappingStaffContract(
  contracts: readonly RestaurantStaffContractRow[],
  validFrom: string,
  validTo: string | null,
  excludeContractId?: string,
): RestaurantStaffContractRow | null {
  for (const c of contracts) {
    if (excludeContractId && c.id === excludeContractId) continue;
    if (
      staffContractPeriodsOverlap(
        validFrom,
        validTo,
        c.valid_from,
        c.valid_to,
      )
    ) {
      return c;
    }
  }
  return null;
}
