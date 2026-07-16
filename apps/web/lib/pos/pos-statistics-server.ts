import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  posRestaurantYmdRangeBounds,
  shiftYmd,
} from "@/lib/pos/pos-day-range-server";
import { restaurantZonedDateKey } from "@/lib/restaurant/restaurant-timezone";
import type { RegisterSessionRow } from "@/lib/pos/register-sessions-server";

export type PosStatisticsDayBucket = {
  ymd: string;
  netCents: number;
  tipCents: number;
  grossCents: number;
  paymentCount: number;
  cashCents: number;
  cardCents: number;
  otherCents: number;
};

export type PosStatisticsZSession = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingCashCents: number;
  closingCashCents: number | null;
  expectedCashCents: number | null;
  cashDifferenceCents: number | null;
  zNr: number | null;
};

export type PosStatisticsBundle = {
  fromYmd: string;
  toYmd: string;
  timeZone: string;
  netCents: number;
  tipCents: number;
  grossCents: number;
  refundedCents: number;
  paymentCount: number;
  refundedCount: number;
  avgBonCents: number;
  byMethod: {
    cashCents: number;
    cardCents: number;
    otherCents: number;
    cashCount: number;
    cardCount: number;
    otherCount: number;
  };
  byDay: PosStatisticsDayBucket[];
  zSessions: PosStatisticsZSession[];
};

function methodBucket(method: string): "cash" | "card" | "other" {
  const m = method.trim().toLowerCase();
  if (m === "cash" || m === "bar") return "cash";
  if (m === "card" || m === "karte" || m === "mollie" || m === "terminal") {
    return "card";
  }
  return "other";
}

function mapZSession(row: RegisterSessionRow): PosStatisticsZSession {
  return {
    id: row.id,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openingCashCents: row.opening_cash_cents,
    closingCashCents: row.closing_cash_cents,
    expectedCashCents: row.expected_cash_cents,
    cashDifferenceCents: row.cash_difference_cents,
    zNr: row.z_nr,
  };
}

export async function loadPosStatisticsBundle(
  supabase: SupabaseClient,
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
): Promise<PosStatisticsBundle | null> {
  const bounds = await posRestaurantYmdRangeBounds(
    restaurantId,
    fromYmd,
    toYmd,
  );
  if (!bounds) return null;

  const { data: payments, error } = await supabase
    .from("pos_payments")
    .select("id, method, status, amount_cents, tip_cents, paid_at")
    .eq("restaurant_id", restaurantId)
    .in("status", ["paid", "refunded"])
    .gte("paid_at", bounds.startAt)
    .lt("paid_at", bounds.endAt)
    .order("paid_at", { ascending: true })
    .limit(5000);

  if (error) {
    console.warn("[pos] statistics payments", error.message);
  }

  const dayMap = new Map<string, PosStatisticsDayBucket>();
  for (let ymd = fromYmd; ymd <= toYmd; ymd = shiftYmd(ymd, 1)) {
    dayMap.set(ymd, {
      ymd,
      netCents: 0,
      tipCents: 0,
      grossCents: 0,
      paymentCount: 0,
      cashCents: 0,
      cardCents: 0,
      otherCents: 0,
    });
  }

  let netCents = 0;
  let tipCents = 0;
  let refundedCents = 0;
  let paymentCount = 0;
  let refundedCount = 0;
  let cashCents = 0;
  let cardCents = 0;
  let otherCents = 0;
  let cashCount = 0;
  let cardCount = 0;
  let otherCount = 0;

  for (const p of payments ?? []) {
    const amount = Number(p.amount_cents);
    const tip = Number(p.tip_cents ?? 0);
    const paidAt = p.paid_at as string | null;
    const ymd = paidAt
      ? restaurantZonedDateKey(new Date(paidAt), bounds.timeZone)
      : fromYmd;
    const bucket = dayMap.get(ymd);
    const method = methodBucket(String(p.method ?? ""));

    if (p.status === "refunded") {
      refundedCents += amount + tip;
      refundedCount += 1;
      continue;
    }

    netCents += amount;
    tipCents += tip;
    paymentCount += 1;

    if (method === "cash") {
      cashCents += amount + tip;
      cashCount += 1;
    } else if (method === "card") {
      cardCents += amount + tip;
      cardCount += 1;
    } else {
      otherCents += amount + tip;
      otherCount += 1;
    }

    if (bucket) {
      bucket.netCents += amount;
      bucket.tipCents += tip;
      bucket.grossCents += amount + tip;
      bucket.paymentCount += 1;
      if (method === "cash") bucket.cashCents += amount + tip;
      else if (method === "card") bucket.cardCents += amount + tip;
      else bucket.otherCents += amount + tip;
    }
  }

  const admin = createSupabaseAdminClient();
  let zSessions: PosStatisticsZSession[] = [];
  if (admin) {
    const { data: sessions, error: sessError } = await admin
      .from("pos_register_sessions")
      .select(
        "id, opened_at, closed_at, opening_cash_cents, closing_cash_cents, expected_cash_cents, cash_difference_cents, z_nr, cash_point_closing_id, dsfinvk_business_date",
      )
      .eq("restaurant_id", restaurantId)
      .not("closed_at", "is", null)
      .gte("closed_at", bounds.startAt)
      .lt("closed_at", bounds.endAt)
      .order("closed_at", { ascending: false })
      .limit(100);

    if (sessError) {
      console.warn("[pos] statistics z sessions", sessError.message);
    } else {
      zSessions = ((sessions ?? []) as RegisterSessionRow[]).map(mapZSession);
    }
  }

  const grossCents = netCents + tipCents;
  return {
    fromYmd,
    toYmd,
    timeZone: bounds.timeZone,
    netCents,
    tipCents,
    grossCents,
    refundedCents,
    paymentCount,
    refundedCount,
    avgBonCents:
      paymentCount === 0 ? 0 : Math.round(grossCents / paymentCount),
    byMethod: {
      cashCents,
      cardCents,
      otherCents,
      cashCount,
      cardCount,
      otherCount,
    },
    byDay: [...dayMap.values()],
    zSessions,
  };
}
