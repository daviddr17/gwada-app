import type { MenuItemAnalyticsRow } from "@/lib/supabase/menu-analytics-db";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type MenuStatsPeriod = 3 | 6 | 12;

export type MenuStatisticsInput = {
  items: MenuItemAnalyticsRow[];
  categoryNames: Map<string, string>;
  periodStart: Date;
  periodEnd: Date;
};

export type MenuStatisticsResult = {
  dishesTotal: number;
  dishesActive: number;
  categoriesUsed: number;
  newDishesInPeriod: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  withRecipeCount: number;
  withImageCount: number;
  withTagsCount: number;
  withoutCategoryCount: number;
  topCategory: string | null;
  topCategoryCount: number;
  byCategory: Array<{ name: string; count: number }>;
  byPriceBand: Array<{ name: string; count: number; fill: string }>;
  byMonth: Array<{ month: string; count: number }>;
  byWeekday: Array<{ day: string; dayIndex: number; count: number }>;
  activeVsInactive: Array<{ name: string; count: number; fill: string }>;
};

function inPeriod(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function priceBand(price: number): string {
  if (price <= 0) return "Ohne Preis";
  if (price < 10) return "Unter 10 €";
  if (price < 20) return "10–20 €";
  if (price < 30) return "20–30 €";
  return "30 €+";
}

export function formatMenuPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(price);
}

export function computeMenuStatistics(
  input: MenuStatisticsInput,
): MenuStatisticsResult {
  const activeItems = input.items.filter((row) => row.is_active);
  const newInPeriod = input.items.filter((row) =>
    inPeriod(row.created_at, input.periodStart, input.periodEnd),
  );

  const priced = activeItems.filter((row) => row.price > 0);
  const avgPrice =
    priced.length > 0
      ? priced.reduce((sum, row) => sum + row.price, 0) / priced.length
      : null;
  const prices = priced.map((row) => row.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

  const categoryIds = new Set(
    activeItems
      .map((row) => row.category_id)
      .filter((id) => input.categoryNames.has(id)),
  );

  const categoryCounts = new Map<string, number>();
  let withoutCategoryCount = 0;
  for (const row of activeItems) {
    const name = input.categoryNames.get(row.category_id);
    if (!name) {
      withoutCategoryCount += 1;
      continue;
    }
    categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
  }
  const byCategory = [...categoryCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const topCategory = byCategory[0]?.name ?? null;
  const topCategoryCount = byCategory[0]?.count ?? 0;

  const bandCounts = new Map<string, number>();
  for (const row of activeItems) {
    const band = priceBand(row.price);
    bandCounts.set(band, (bandCounts.get(band) ?? 0) + 1);
  }
  const bandColors: Record<string, string> = {
    "Ohne Preis": "var(--chart-5)",
    "Unter 10 €": "var(--chart-1)",
    "10–20 €": "var(--chart-2)",
    "20–30 €": "var(--chart-3)",
    "30 €+": "var(--chart-4)",
  };
  const byPriceBand = [...bandCounts.entries()].map(([name, count]) => ({
    name,
    count,
    fill: bandColors[name] ?? "var(--accent)",
  }));

  const monthCounts = new Map<string, number>();
  for (const row of newInPeriod) {
    const key = monthKey(row.created_at);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const byMonth = [...monthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: formatMonthLabel(month),
      count,
    }));

  const weekdayCounts = new Map<number, number>();
  for (const row of newInPeriod) {
    const d = new Date(row.created_at).getDay();
    weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1);
  }
  const byWeekday = WEEKDAY_ORDER.map((dayIndex) => ({
    dayIndex,
    day: WEEKDAY_SHORT[dayIndex],
    count: weekdayCounts.get(dayIndex) ?? 0,
  }));

  const inactiveCount = input.items.length - activeItems.length;
  const activeVsInactive = [
    { name: "Aktiv", count: activeItems.length, fill: "var(--chart-2)" },
    { name: "Inaktiv", count: inactiveCount, fill: "var(--chart-5)" },
  ].filter((row) => row.count > 0);

  return {
    dishesTotal: input.items.length,
    dishesActive: activeItems.length,
    categoriesUsed: categoryIds.size,
    newDishesInPeriod: newInPeriod.length,
    avgPrice,
    minPrice,
    maxPrice,
    withRecipeCount: activeItems.filter((row) => row.recipe_line_count > 0).length,
    withImageCount: activeItems.filter((row) => row.has_image).length,
    withTagsCount: activeItems.filter((row) => row.tag_count > 0).length,
    withoutCategoryCount,
    topCategory,
    topCategoryCount,
    byCategory,
    byPriceBand,
    byMonth,
    byWeekday,
    activeVsInactive,
  };
}
