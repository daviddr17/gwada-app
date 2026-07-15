import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountingStatsPeriod } from "@/lib/accounting/compute-accounting-statistics";
import type { AccountingCashDirection } from "@/lib/types/accounting-cash-book";
import type {
  AccountingSource,
  AccountingTotals,
  AccountingVoucherKind,
} from "@/lib/types/accounting";
import { startOfLocalDay } from "@/lib/reservations/month-range";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type AccountingInvoiceAnalyticsRow = {
  id: string;
  status: string;
  source: AccountingSource;
  created_at: string;
  total_gross: number;
};

export type AccountingQuotationAnalyticsRow = AccountingInvoiceAnalyticsRow;

export type AccountingVoucherAnalyticsRow = {
  id: string;
  status: string;
  source: AccountingSource;
  voucher_kind: AccountingVoucherKind;
  created_at: string;
  total_gross_amount: number;
};

export type AccountingCashAnalyticsRow = {
  id: string;
  direction: AccountingCashDirection;
  amount: number;
  entry_date: string;
  created_at: string;
};

export type AccountingStatisticsBundle = {
  invoices: AccountingInvoiceAnalyticsRow[];
  quotations: AccountingQuotationAnalyticsRow[];
  vouchers: AccountingVoucherAnalyticsRow[];
  cashEntries: AccountingCashAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
};

const INVOICE_SELECT =
  "id, status, source, created_at, totals, document_variant";
const QUOTATION_SELECT = "id, status, source, created_at, totals";
const VOUCHER_SELECT =
  "id, status, source, voucher_kind, created_at, total_gross_amount, document_variant";
const CASH_SELECT = "id, direction, amount, entry_date, created_at";

function periodRange(monthsBack: AccountingStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodEnd = startOfLocalDay(new Date());
  periodEnd.setHours(23, 59, 59, 999);
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return { periodStart, periodEnd };
}

function parseTotals(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const totals = raw as AccountingTotals;
  return Number(totals.totalGross ?? 0);
}

function mapInvoiceRow(raw: Record<string, unknown>): AccountingInvoiceAnalyticsRow {
  return {
    id: raw.id as string,
    status: raw.status as string,
    source: raw.source as AccountingSource,
    created_at: raw.created_at as string,
    total_gross: parseTotals(raw.totals),
  };
}

function mapVoucherRow(raw: Record<string, unknown>): AccountingVoucherAnalyticsRow {
  return {
    id: raw.id as string,
    status: raw.status as string,
    source: raw.source as AccountingSource,
    voucher_kind: raw.voucher_kind as AccountingVoucherKind,
    created_at: raw.created_at as string,
    total_gross_amount: Number(raw.total_gross_amount ?? 0),
  };
}

function mapCashRow(raw: Record<string, unknown>): AccountingCashAnalyticsRow {
  return {
    id: raw.id as string,
    direction: raw.direction as AccountingCashDirection,
    amount: Number(raw.amount ?? 0),
    entry_date: raw.entry_date as string,
    created_at: raw.created_at as string,
  };
}

export async function fetchAccountingStatisticsBundleWithClient(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    monthsBack?: AccountingStatsPeriod;
    periodStart?: Date;
    periodEnd?: Date;
  },
): Promise<{ data: AccountingStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  let periodStart: Date;
  let periodEnd: Date;
  if (params.periodStart && params.periodEnd) {
    periodStart = params.periodStart;
    periodEnd = params.periodEnd;
  } else {
    const months = params.monthsBack ?? 12;
    ({ periodStart, periodEnd } = periodRange(months));
  }

  const [invoicesRes, quotationsRes, vouchersRes, cashRes] = await Promise.all([
    sb
      .from("accounting_invoices")
      .select(INVOICE_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .neq("document_variant", "correction")
      .order("created_at", { ascending: true }),
    sb
      .from("accounting_quotations")
      .select(QUOTATION_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .order("created_at", { ascending: true }),
    sb
      .from("accounting_vouchers")
      .select(VOUCHER_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .neq("document_variant", "correction")
      .order("created_at", { ascending: true }),
    sb
      .from("accounting_cash_entries")
      .select(CASH_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .order("created_at", { ascending: true }),
  ]);

  const error =
    invoicesRes.error?.message ??
    quotationsRes.error?.message ??
    vouchersRes.error?.message ??
    cashRes.error?.message ??
    null;
  if (error) {
    return { data: null, error };
  }

  return {
    data: {
      invoices: (invoicesRes.data ?? []).map((raw) =>
        mapInvoiceRow(raw as Record<string, unknown>),
      ),
      quotations: (quotationsRes.data ?? []).map((raw) =>
        mapInvoiceRow(raw as Record<string, unknown>),
      ),
      vouchers: (vouchersRes.data ?? []).map((raw) =>
        mapVoucherRow(raw as Record<string, unknown>),
      ),
      cashEntries: (cashRes.data ?? []).map((raw) =>
        mapCashRow(raw as Record<string, unknown>),
      ),
      periodStart,
      periodEnd,
    },
    error: null,
  };
}

export async function fetchAccountingStatisticsBundle(params: {
  restaurantId: string;
  monthsBack?: AccountingStatsPeriod;
}): Promise<{ data: AccountingStatisticsBundle | null; error: string | null }> {
  return fetchAccountingStatisticsBundleWithClient(
    createSupabaseBrowserClient(),
    params,
  );
}
