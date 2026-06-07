import { formatLocaleLabel } from "@/lib/constants/locale-labels";
import type { SuperadminUserRow } from "@/lib/supabase/platform-superadmin-db";
import {
  countByLabel,
  countByMonth,
  countInLastDays,
  cumulativeByMonth,
  daysBetween,
  lastMonthKeys,
  type LabelCount,
} from "@/lib/superadmin/stats-series";

const CHART_MONTHS = 12;

export type SuperadminUserStats = {
  kpis: {
    total: number;
    newLast30Days: number;
    activeLast30Days: number;
    withRestaurant: number;
    neverSignedIn: number;
  };
  registrationsByMonth: { label: string; count: number }[];
  cumulativeUsers: { label: string; total: number }[];
  localeDistribution: LabelCount[];
  signInRecency: LabelCount[];
  restaurantsPerUser: LabelCount[];
};

export function computeUserStats(rows: SuperadminUserRow[]): SuperadminUserStats {
  const monthKeys = lastMonthKeys(CHART_MONTHS);
  const createdAts = rows.map((r) => r.created_at).filter(Boolean);

  const signInRecency = countByLabel(rows, (r) => {
    if (!r.last_sign_in_at) return "Nie angemeldet";
    const days = daysBetween(r.last_sign_in_at);
    if (days <= 7) return "≤ 7 Tage";
    if (days <= 30) return "8–30 Tage";
    if (days <= 90) return "31–90 Tage";
    return "> 90 Tage";
  });

  const order = [
    "≤ 7 Tage",
    "8–30 Tage",
    "31–90 Tage",
    "> 90 Tage",
    "Nie angemeldet",
  ];
  signInRecency.sort(
    (a, b) => order.indexOf(a.name) - order.indexOf(b.name) || 0,
  );

  const restaurantsPerUser = countByLabel(rows, (r) => {
    const n = r.restaurant_count;
    if (n <= 0) return "0 Restaurants";
    if (n === 1) return "1 Restaurant";
    return "2+ Restaurants";
  });
  const restOrder = ["0 Restaurants", "1 Restaurant", "2+ Restaurants"];
  restaurantsPerUser.sort(
    (a, b) => restOrder.indexOf(a.name) - restOrder.indexOf(b.name) || 0,
  );

  return {
    kpis: {
      total: rows.length,
      newLast30Days: countInLastDays(createdAts, 30),
      activeLast30Days: countInLastDays(
        rows.map((r) => r.last_sign_in_at),
        30,
      ),
      withRestaurant: rows.filter((r) => r.restaurant_count > 0).length,
      neverSignedIn: rows.filter((r) => !r.last_sign_in_at).length,
    },
    registrationsByMonth: countByMonth(createdAts, monthKeys).map((p) => ({
      label: p.label,
      count: p.count,
    })),
    cumulativeUsers: cumulativeByMonth(createdAts, monthKeys).map((p) => ({
      label: p.label,
      total: p.total,
    })),
    localeDistribution: countByLabel(
      rows,
      (r) => (r.locale ? formatLocaleLabel(r.locale) : "Ohne Sprache"),
      { top: 8 },
    ),
    signInRecency,
    restaurantsPerUser,
  };
}
