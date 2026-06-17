import type { AccountingCashDirection } from "@/lib/types/accounting-cash-book";
import type {
  AccountingSource,
  AccountingVoucherKind,
} from "@/lib/types/accounting";
import type {
  AccountingCashAnalyticsRow,
  AccountingInvoiceAnalyticsRow,
  AccountingQuotationAnalyticsRow,
  AccountingVoucherAnalyticsRow,
} from "@/lib/supabase/accounting-analytics-db";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type AccountingStatsPeriod = 3 | 6 | 12;

const SOURCE_LABELS: Record<AccountingSource, string> = {
  gwada: "Gwada",
  lexoffice: "Lexoffice",
};

const SOURCE_COLORS: Record<AccountingSource, string> = {
  gwada: "var(--accent)",
  lexoffice: "var(--chart-2)",
};

const VOUCHER_KIND_LABELS: Record<AccountingVoucherKind, string> = {
  expense: "Ausgabe",
  income: "Einnahme",
  purchase: "Einkauf",
  sales: "Verkauf",
};

const VOUCHER_KIND_COLORS: Record<AccountingVoucherKind, string> = {
  expense: "var(--chart-1)",
  income: "var(--chart-2)",
  purchase: "var(--chart-3)",
  sales: "var(--chart-4)",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  open: "Offen",
  sent: "Versendet",
  paid: "Bezahlt",
  voided: "Storniert",
  overdue: "Überfällig",
};

const CASH_DIRECTION_LABELS: Record<AccountingCashDirection, string> = {
  income: "Einnahmen",
  expense: "Ausgaben",
};

export type AccountingStatisticsInput = {
  invoices: AccountingInvoiceAnalyticsRow[];
  quotations: AccountingQuotationAnalyticsRow[];
  vouchers: AccountingVoucherAnalyticsRow[];
  cashEntries: AccountingCashAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
};

export type AccountingStatisticsResult = {
  invoicesInPeriod: number;
  quotationsInPeriod: number;
  vouchersInPeriod: number;
  cashEntriesInPeriod: number;
  openInvoices: number;
  paidInvoicesInPeriod: number;
  invoiceGrossInPeriod: number;
  voucherGrossInPeriod: number;
  cashIncomeInPeriod: number;
  cashExpenseInPeriod: number;
  gwadaDocumentsInPeriod: number;
  lexofficeDocumentsInPeriod: number;
  topVoucherKind: string | null;
  topInvoiceStatus: string | null;
  byDocumentType: Array<{ name: string; count: number; fill: string }>;
  bySource: Array<{ source: AccountingSource; label: string; count: number; color: string }>;
  byInvoiceStatus: Array<{ name: string; count: number; fill: string }>;
  byVoucherKind: Array<{ kind: string; label: string; count: number; fill: string }>;
  byCashDirection: Array<{ name: string; count: number; fill: string }>;
  byMonth: Array<{ month: string; count: number }>;
  byWeekday: Array<{ day: string; dayIndex: number; count: number }>;
  cashByMonth: Array<{ month: string; income: number; expense: number }>;
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

export function formatAccountingMoney(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function computeAccountingStatistics(
  input: AccountingStatisticsInput,
): AccountingStatisticsResult {
  const invoicesInPeriod = input.invoices.filter((row) =>
    inPeriod(row.created_at, input.periodStart, input.periodEnd),
  );
  const quotationsInPeriod = input.quotations.filter((row) =>
    inPeriod(row.created_at, input.periodStart, input.periodEnd),
  );
  const vouchersInPeriod = input.vouchers.filter((row) =>
    inPeriod(row.created_at, input.periodStart, input.periodEnd),
  );
  const cashInPeriod = input.cashEntries.filter((row) =>
    inPeriod(row.created_at, input.periodStart, input.periodEnd),
  );

  const openInvoices = input.invoices.filter(
    (row) => row.status === "open" || row.status === "overdue",
  ).length;
  const paidInvoicesInPeriod = invoicesInPeriod.filter(
    (row) => row.status === "paid",
  ).length;

  const invoiceGrossInPeriod = invoicesInPeriod.reduce(
    (sum, row) => sum + row.total_gross,
    0,
  );
  const voucherGrossInPeriod = vouchersInPeriod.reduce(
    (sum, row) => sum + row.total_gross_amount,
    0,
  );

  let cashIncomeInPeriod = 0;
  let cashExpenseInPeriod = 0;
  for (const row of cashInPeriod) {
    if (row.direction === "income") cashIncomeInPeriod += row.amount;
    else cashExpenseInPeriod += row.amount;
  }

  const documentsInPeriod = [
    ...invoicesInPeriod,
    ...quotationsInPeriod,
    ...vouchersInPeriod,
  ];
  const gwadaDocumentsInPeriod = documentsInPeriod.filter(
    (row) => row.source === "gwada",
  ).length;
  const lexofficeDocumentsInPeriod = documentsInPeriod.filter(
    (row) => row.source === "lexoffice",
  ).length;

  const byDocumentType = [
    {
      name: "Rechnungen",
      count: invoicesInPeriod.length,
      fill: "var(--chart-1)",
    },
    {
      name: "Angebote",
      count: quotationsInPeriod.length,
      fill: "var(--chart-2)",
    },
    {
      name: "Belege",
      count: vouchersInPeriod.length,
      fill: "var(--chart-3)",
    },
    {
      name: "Kasse",
      count: cashInPeriod.length,
      fill: "var(--chart-4)",
    },
  ].filter((row) => row.count > 0);

  const sourceCounts = new Map<AccountingSource, number>();
  for (const row of documentsInPeriod) {
    sourceCounts.set(row.source, (sourceCounts.get(row.source) ?? 0) + 1);
  }
  const bySource = (Object.keys(SOURCE_LABELS) as AccountingSource[])
    .map((source) => ({
      source,
      label: SOURCE_LABELS[source],
      count: sourceCounts.get(source) ?? 0,
      color: SOURCE_COLORS[source],
    }))
    .filter((row) => row.count > 0);

  const statusCounts = new Map<string, number>();
  for (const row of invoicesInPeriod) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }
  const byInvoiceStatus = [...statusCounts.entries()]
    .map(([status, count]) => ({
      name: INVOICE_STATUS_LABELS[status] ?? status,
      count,
      fill: "var(--chart-5)",
    }))
    .sort((a, b) => b.count - a.count);
  const topInvoiceStatus = byInvoiceStatus[0]?.name ?? null;

  const kindCounts = new Map<AccountingVoucherKind, number>();
  for (const row of vouchersInPeriod) {
    kindCounts.set(
      row.voucher_kind,
      (kindCounts.get(row.voucher_kind) ?? 0) + 1,
    );
  }
  const byVoucherKind = (
    Object.keys(VOUCHER_KIND_LABELS) as AccountingVoucherKind[]
  )
    .map((kind) => ({
      kind,
      label: VOUCHER_KIND_LABELS[kind],
      count: kindCounts.get(kind) ?? 0,
      fill: VOUCHER_KIND_COLORS[kind],
    }))
    .filter((row) => row.count > 0);
  const topVoucherKindEntry = [...byVoucherKind].sort(
    (a, b) => b.count - a.count,
  )[0];
  const topVoucherKind = topVoucherKindEntry?.label ?? null;

  const byCashDirection = (
    Object.keys(CASH_DIRECTION_LABELS) as AccountingCashDirection[]
  )
    .map((direction) => ({
      name: CASH_DIRECTION_LABELS[direction],
      count: cashInPeriod.filter((row) => row.direction === direction).length,
      fill: direction === "income" ? "var(--chart-2)" : "var(--chart-1)",
    }))
    .filter((row) => row.count > 0);

  const monthCounts = new Map<string, number>();
  const cashMonthIncome = new Map<string, number>();
  const cashMonthExpense = new Map<string, number>();
  for (const row of [
    ...invoicesInPeriod,
    ...quotationsInPeriod,
    ...vouchersInPeriod,
  ]) {
    const key = monthKey(row.created_at);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  for (const row of cashInPeriod) {
    const key = monthKey(row.entry_date);
    if (row.direction === "income") {
      cashMonthIncome.set(
        key,
        (cashMonthIncome.get(key) ?? 0) + row.amount,
      );
    } else {
      cashMonthExpense.set(
        key,
        (cashMonthExpense.get(key) ?? 0) + row.amount,
      );
    }
  }

  const monthKeys = new Set([
    ...monthCounts.keys(),
    ...cashMonthIncome.keys(),
    ...cashMonthExpense.keys(),
  ]);
  const byMonth = [...monthKeys]
    .sort()
    .map((month) => ({
      month: formatMonthLabel(month),
      count: monthCounts.get(month) ?? 0,
    }));
  const cashByMonth = [...monthKeys].sort().map((month) => ({
    month: formatMonthLabel(month),
    income: cashMonthIncome.get(month) ?? 0,
    expense: cashMonthExpense.get(month) ?? 0,
  }));

  const weekdayCounts = new Map<number, number>();
  for (const row of documentsInPeriod) {
    const d = new Date(row.created_at).getDay();
    weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1);
  }
  const byWeekday = WEEKDAY_ORDER.map((dayIndex) => ({
    dayIndex,
    day: WEEKDAY_SHORT[dayIndex],
    count: weekdayCounts.get(dayIndex) ?? 0,
  }));

  return {
    invoicesInPeriod: invoicesInPeriod.length,
    quotationsInPeriod: quotationsInPeriod.length,
    vouchersInPeriod: vouchersInPeriod.length,
    cashEntriesInPeriod: cashInPeriod.length,
    openInvoices,
    paidInvoicesInPeriod,
    invoiceGrossInPeriod,
    voucherGrossInPeriod,
    cashIncomeInPeriod,
    cashExpenseInPeriod,
    gwadaDocumentsInPeriod,
    lexofficeDocumentsInPeriod,
    topVoucherKind,
    topInvoiceStatus,
    byDocumentType,
    bySource,
    byInvoiceStatus,
    byVoucherKind,
    byCashDirection,
    byMonth,
    byWeekday,
    cashByMonth,
  };
}
