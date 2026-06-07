import "server-only";

import { resolveCountryIso2FromLabel } from "@/lib/constants/countries";

export type PublicHolidayEntry = {
  date: string;
  name: string;
};

type NagerHoliday = {
  date: string;
  localName: string;
  name: string;
};

const yearCache = new Map<string, PublicHolidayEntry[]>();

export function resolveRestaurantCountryIso2(countryLabel: string): string {
  return resolveCountryIso2FromLabel(countryLabel);
}

async function fetchHolidaysForYear(
  countryIso2: string,
  year: number,
): Promise<PublicHolidayEntry[]> {
  const iso = countryIso2.toUpperCase();
  const cacheKey = `${iso}-${year}`;
  const cached = yearCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${iso}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    yearCache.set(cacheKey, []);
    return [];
  }

  const raw = (await res.json().catch(() => [])) as NagerHoliday[];
  const entries: PublicHolidayEntry[] = raw.map((h) => ({
    date: h.date,
    name: (h.localName?.trim() || h.name?.trim() || "Feiertag").slice(0, 120),
  }));
  yearCache.set(cacheKey, entries);
  return entries;
}

/** Feiertage im Datumsbereich (inklusive), `from`/`to` als YYYY-MM-DD. */
export async function listPublicHolidaysInRange(
  countryLabel: string,
  fromYmd: string,
  toYmd: string,
): Promise<PublicHolidayEntry[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    return [];
  }
  if (fromYmd > toYmd) return [];

  const iso2 = resolveRestaurantCountryIso2(countryLabel);
  const fromYear = Number(fromYmd.slice(0, 4));
  const toYear = Number(toYmd.slice(0, 4));
  const years = new Set<number>();
  for (let y = fromYear; y <= toYear; y++) years.add(y);

  const all: PublicHolidayEntry[] = [];
  for (const year of years) {
    const chunk = await fetchHolidaysForYear(iso2, year);
    all.push(...chunk);
  }

  return all
    .filter((h) => h.date >= fromYmd && h.date <= toYmd)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function publicHolidaysByDate(
  entries: PublicHolidayEntry[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of entries) {
    if (!map[h.date]) map[h.date] = h.name;
  }
  return map;
}

/** Vorschläge für Ausnahmen: heute bis einschließlich +31 Tage. */
export async function listUpcomingHolidaySuggestions(
  countryLabel: string,
  todayYmd: string,
  maxDaysAhead = 31,
): Promise<PublicHolidayEntry[]> {
  const start = new Date(`${todayYmd}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + maxDaysAhead);
  const toYmd = end.toISOString().slice(0, 10);
  return listPublicHolidaysInRange(countryLabel, todayYmd, toYmd);
}
