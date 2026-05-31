const MS_DAY = 86_400_000;

export function monthKeyFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatMonthKeyLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/** Letzte N Kalendermonate (inkl. aktueller Monat), chronologisch. */
export function lastMonthKeys(count: number, ref = new Date()): string[] {
  const end = startOfMonth(ref);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(monthKeyFromIso(addMonths(end, -i).toISOString()));
  }
  return keys;
}

export function countByMonth(
  timestamps: readonly string[],
  monthKeys: readonly string[],
): { monthKey: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const iso of timestamps) {
    const key = monthKeyFromIso(iso);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return monthKeys.map((monthKey) => ({
    monthKey,
    label: formatMonthKeyLabel(monthKey),
    count: counts.get(monthKey) ?? 0,
  }));
}

/** Kumulierte Anzahl Einträge mit Zeitstempel ≤ Monatsende. */
export function cumulativeByMonth(
  timestamps: readonly string[],
  monthKeys: readonly string[],
): { monthKey: string; label: string; total: number }[] {
  const parsed = timestamps
    .map((iso) => new Date(iso).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  return monthKeys.map((monthKey) => {
    const [y, m] = monthKey.split("-").map(Number);
    const end = new Date(y, m, 0, 23, 59, 59, 999).getTime();
    let total = 0;
    for (const t of parsed) {
      if (t <= end) total++;
      else break;
    }
    return {
      monthKey,
      label: formatMonthKeyLabel(monthKey),
      total,
    };
  });
}

export function daysBetween(iso: string, ref = new Date()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.floor((ref.getTime() - t) / MS_DAY);
}

export function countInLastDays(
  timestamps: readonly (string | null)[],
  days: number,
  ref = new Date(),
): number {
  const cutoff = ref.getTime() - days * MS_DAY;
  return timestamps.filter((iso) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  }).length;
}

export type LabelCount = { name: string; count: number };

/** Häufigkeiten nach Label, absteigend sortiert. */
export function countByLabel<T>(
  items: readonly T[],
  labelOf: (item: T) => string,
  options?: { top?: number; emptyLabel?: string },
): LabelCount[] {
  const empty = options?.emptyLabel ?? "Unbekannt";
  const map = new Map<string, number>();
  for (const item of items) {
    const raw = labelOf(item).trim();
    const name = raw || empty;
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  const sorted = [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"));
  const top = options?.top;
  return top ? sorted.slice(0, top) : sorted;
}
