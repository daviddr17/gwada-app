export type AccountingCashDirection = "income" | "expense";

export type AccountingCashCategoryRow = {
  id: string;
  restaurant_id: string;
  direction: AccountingCashDirection;
  name: string;
  sort_order: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type AccountingCashBookSettingsRow = {
  restaurant_id: string;
  opening_balance: number;
  created_at: string;
  updated_at: string;
};

export type AccountingCashEntryTaxLine = {
  id: string;
  sortOrder: number;
  amount: number;
  taxRatePercent: number;
  taxAmount: number;
};

export type AccountingCashEntryTaxLineInput = {
  id?: string;
  amount: number;
  tax_rate_percent: number;
};

export type AccountingCashEntryRow = {
  id: string;
  restaurant_id: string;
  entry_date: string;
  direction: AccountingCashDirection;
  category_id: string;
  amount: number;
  tax_rate_percent: number;
  note: string | null;
  voucher_id: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from category */
  category_name?: string;
  /** Joined from voucher */
  voucher_number?: string | null;
  voucher_contact_name?: string | null;
  tax_lines?: AccountingCashEntryTaxLine[];
};

export type AccountingCashBookSummary = {
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
};

export type AccountingCashBookListResult = {
  entries: AccountingCashEntryRow[];
  summary: AccountingCashBookSummary;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AccountingCashEntryInput = {
  id?: string;
  entry_date: string;
  direction: AccountingCashDirection;
  category_id: string;
  note?: string | null;
  voucher_id?: string | null;
  tax_lines: AccountingCashEntryTaxLineInput[];
};
