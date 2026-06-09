import type {
  AccountingQuotationRow,
  AccountingSalesDocumentInput,
  AccountingSource,
  AccountingVoucherRow,
} from "@/lib/types/accounting";

export type AccountingProviderKey = AccountingSource;

export type CreateSalesDocumentResult = {
  source: AccountingSource;
  externalId: string | null;
  externalVersion: number | null;
  externalEditUrl: string | null;
  voucherNumber: string | null;
  status: string;
};

export type AccountingSalesDocumentProvider = {
  key: AccountingProviderKey;
  createInvoice(
    restaurantId: string,
    input: AccountingSalesDocumentInput,
  ): Promise<CreateSalesDocumentResult>;
  createQuotation(
    restaurantId: string,
    input: AccountingSalesDocumentInput,
  ): Promise<CreateSalesDocumentResult>;
};

export type AccountingVoucherListItem = Pick<
  AccountingVoucherRow,
  | "id"
  | "source"
  | "external_id"
  | "voucher_kind"
  | "status"
  | "voucher_number"
  | "voucher_date"
  | "total_gross_amount"
  | "currency"
  | "contact_name"
  | "external_edit_url"
>;

export type ListAccountingDocumentsParams = {
  restaurantId: string;
  source?: AccountingSource | null;
};
