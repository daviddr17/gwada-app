export type PosZAutopilotStepStatus =
  | "pending"
  | "ok"
  | "error"
  | "skipped"
  | "waiting";

export type PosZAutopilotStepKey =
  | "cash_book"
  | "lexoffice_sales"
  | "unbar"
  | "psp_fees";

export type PosZAutopilotStep = {
  key: PosZAutopilotStepKey;
  label: string;
  status: PosZAutopilotStepStatus;
  detail?: string | null;
  error?: string | null;
};

export type PosZAutopilotStatus =
  | "pending"
  | "running"
  | "ok"
  | "partial"
  | "error"
  | "skipped";

export type AccountingPspProvider = "mollie" | "adyen" | "other";

export type PosZAutopilotImportRow = {
  id: string;
  restaurant_id: string;
  pos_register_session_id: string;
  z_nr: number | null;
  business_date: string | null;
  status: PosZAutopilotStatus;
  steps: PosZAutopilotStep[];
  cash_book_imported: boolean;
  cash_entry_ids: string[];
  lexoffice_voucher_id: string | null;
  unbar_gross_cents: number;
  fee_cents: number;
  fee_voucher_id: string | null;
  retry_count: number;
  last_error: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
