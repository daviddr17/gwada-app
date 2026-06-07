import type { SuperadminRestaurantRow } from "@/lib/supabase/platform-superadmin-db";
import {
  countByLabel,
  countByMonth,
  countInLastDays,
  cumulativeByMonth,
  lastMonthKeys,
  type LabelCount,
} from "@/lib/superadmin/stats-series";

const CHART_MONTHS = 12;

export type SuperadminRestaurantStats = {
  kpis: {
    total: number;
    published: number;
    draft: number;
    newLast30Days: number;
    avgEmployees: number;
  };
  createdByMonth: { label: string; count: number }[];
  cumulativeRestaurants: { label: string; total: number }[];
  publishedVsDraft: LabelCount[];
  employeesPerRestaurant: LabelCount[];
  timezoneDistribution: LabelCount[];
};

export function computeRestaurantStats(
  rows: SuperadminRestaurantRow[],
): SuperadminRestaurantStats {
  const monthKeys = lastMonthKeys(CHART_MONTHS);
  const createdAts = rows.map((r) => r.created_at).filter(Boolean);

  const employeesPerRestaurant = countByLabel(rows, (r) => {
    const n = r.employee_count;
    if (n === 0) return "Keine Mitarbeitenden";
    if (n <= 2) return "1–2 Mitarbeitende";
    if (n <= 5) return "3–5 Mitarbeitende";
    return "6+ Mitarbeitende";
  });
  const empOrder = [
    "Keine Mitarbeitenden",
    "1–2 Mitarbeitende",
    "3–5 Mitarbeitende",
    "6+ Mitarbeitende",
  ];
  employeesPerRestaurant.sort(
    (a, b) => empOrder.indexOf(a.name) - empOrder.indexOf(b.name) || 0,
  );

  const totalEmployees = rows.reduce((s, r) => s + r.employee_count, 0);

  return {
    kpis: {
      total: rows.length,
      published: rows.filter((r) => r.is_published).length,
      draft: rows.filter((r) => !r.is_published).length,
      newLast30Days: countInLastDays(createdAts, 30),
      avgEmployees: rows.length ? totalEmployees / rows.length : 0,
    },
    createdByMonth: countByMonth(createdAts, monthKeys).map((p) => ({
      label: p.label,
      count: p.count,
    })),
    cumulativeRestaurants: cumulativeByMonth(createdAts, monthKeys).map(
      (p) => ({
        label: p.label,
        total: p.total,
      }),
    ),
    publishedVsDraft: [
      { name: "Veröffentlicht", count: rows.filter((r) => r.is_published).length },
      { name: "Entwurf", count: rows.filter((r) => !r.is_published).length },
    ],
    employeesPerRestaurant,
    timezoneDistribution: countByLabel(rows, (r) => r.timezone?.trim() || "—", {
      top: 8,
    }),
  };
}
