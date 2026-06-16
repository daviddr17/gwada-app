import type { AccountingCashDirection } from "@/lib/types/accounting-cash-book";

export const DEFAULT_ACCOUNTING_CASH_CATEGORIES: ReadonlyArray<{
  direction: AccountingCashDirection;
  name: string;
  sort_order: number;
}> = [
  { direction: "income", name: "Barverkauf", sort_order: 0 },
  { direction: "income", name: "Trinkgeld", sort_order: 1 },
  { direction: "income", name: "Sonstige Einnahme", sort_order: 2 },
  { direction: "expense", name: "Wareneinkauf", sort_order: 0 },
  { direction: "expense", name: "Betriebsausgabe", sort_order: 1 },
  { direction: "expense", name: "Sonstige Ausgabe", sort_order: 2 },
];

export const ACCOUNTING_CASH_DIRECTION_LABELS: Record<
  AccountingCashDirection,
  string
> = {
  income: "Einnahme",
  expense: "Ausgabe",
};
