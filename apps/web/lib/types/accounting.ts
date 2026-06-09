export type AccountingSource = "gwada" | "lexoffice";

export type AccountingTaxMode = "net" | "gross" | "vatfree";

export type AccountingVoucherDateKind = "date" | "period";

export type AccountingRecipientType = "contact" | "one_time";

export type AccountingLineItemType = "custom" | "text" | "article";

export type AccountingLineItem = {
  id: string;
  sortOrder: number;
  type: AccountingLineItemType;
  articleId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitName: string;
  unitPrice: number;
  taxRatePercent: number;
  discountPercent: number;
  lineAmount: number;
};

export type AccountingRecipientSnapshot = {
  name: string;
  supplement?: string | null;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  countryCode?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type AccountingTotals = {
  currency: string;
  totalNet: number;
  totalTax: number;
  totalGross: number;
};

export type AccountingInvoiceStatus =
  | "draft"
  | "open"
  | "sent"
  | "paid"
  | "voided"
  | "overdue";

export type AccountingQuotationStatus =
  | "draft"
  | "open"
  | "sent"
  | "accepted"
  | "rejected"
  | "voided";

export type AccountingVoucherKind = "expense" | "income" | "purchase" | "sales";

export type AccountingVoucherStatus =
  | "draft"
  | "open"
  | "unchecked"
  | "paid"
  | "voided";

export type AccountingVoucherItem = {
  id: string;
  sortOrder: number;
  label: string;
  amount: number;
  taxAmount: number;
  taxRatePercent: number;
  categoryLabel: string | null;
};

export type AccountingTaxRateRow = {
  id: string;
  restaurant_id: string;
  label: string;
  rate_percent: number;
  is_default: boolean;
  sort_order: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type AccountingUnitRow = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type AccountingArticleRow = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  unit_id: string | null;
  default_unit_name: string;
  default_unit_price: number;
  default_tax_rate_percent: number;
  currency: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type AccountingInvoiceRow = {
  id: string;
  restaurant_id: string;
  source: AccountingSource;
  external_id: string | null;
  external_version: number | null;
  external_edit_url: string | null;
  status: AccountingInvoiceStatus;
  voucher_number: string | null;
  voucher_date: string;
  voucher_date_kind: AccountingVoucherDateKind;
  voucher_period_start: string | null;
  voucher_period_end: string | null;
  due_date: string | null;
  delivery_date: string | null;
  currency: string;
  tax_mode: AccountingTaxMode;
  recipient_type: AccountingRecipientType;
  contact_id: string | null;
  recipient_snapshot: AccountingRecipientSnapshot;
  line_items: AccountingLineItem[];
  totals: AccountingTotals;
  title: string | null;
  introduction: string | null;
  remark: string | null;
  finalize_on_create: boolean;
  sent_at: string | null;
  sent_channels: string[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountingQuotationRow = Omit<
  AccountingInvoiceRow,
  "status" | "due_date"
> & {
  status: AccountingQuotationStatus;
  expiration_date: string | null;
};

export type AccountingVoucherRow = {
  id: string;
  restaurant_id: string;
  source: AccountingSource;
  external_id: string | null;
  external_version: number | null;
  external_edit_url: string | null;
  voucher_kind: AccountingVoucherKind;
  status: AccountingVoucherStatus;
  voucher_number: string | null;
  voucher_date: string;
  due_date: string | null;
  shipping_date: string | null;
  currency: string;
  tax_mode: "net" | "gross";
  use_collective_contact: boolean;
  contact_id: string | null;
  contact_name: string | null;
  total_gross_amount: number;
  total_tax_amount: number;
  voucher_items: AccountingVoucherItem[];
  remark: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountingSalesDocumentInput = {
  recipientType: AccountingRecipientType;
  contactId: string | null;
  lexofficeContactId?: string | null;
  recipient: AccountingRecipientSnapshot;
  voucherDate: string;
  voucherDateKind?: AccountingVoucherDateKind;
  voucherPeriodStart?: string | null;
  voucherPeriodEnd?: string | null;
  dueDate?: string | null;
  deliveryDate?: string | null;
  expirationDate?: string | null;
  currency: string;
  taxMode: AccountingTaxMode;
  lineItems: AccountingLineItem[];
  title?: string | null;
  introduction?: string | null;
  remark?: string | null;
  status?: AccountingInvoiceStatus | AccountingQuotationStatus;
  syncToLexoffice?: boolean;
  finalizeOnCreate?: boolean;
  /** Nach Anlegen optional versenden */
  sendOnSave?: boolean;
  sendEmail?: boolean;
  sendWhatsapp?: boolean;
};
