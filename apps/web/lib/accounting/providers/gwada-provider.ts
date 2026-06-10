import type { AccountingSalesDocumentProvider, CreateSalesDocumentResult } from "@/lib/accounting/providers/types";
import type { AccountingSalesDocumentInput } from "@/lib/types/accounting";

export const gwadaAccountingProvider: AccountingSalesDocumentProvider = {
  key: "gwada",
  async createInvoice(
    _restaurantId: string,
    input: AccountingSalesDocumentInput,
  ): Promise<CreateSalesDocumentResult> {
    const status = input.finalizeOnCreate ? "open" : (input.status ?? "draft");
    return {
      source: "gwada",
      externalId: null,
      externalVersion: null,
      externalEditUrl: null,
      voucherNumber: null,
      status,
    };
  },
  async createQuotation(
    _restaurantId: string,
    input: AccountingSalesDocumentInput,
  ): Promise<CreateSalesDocumentResult> {
    const status = input.finalizeOnCreate ? "open" : (input.status ?? "draft");
    return {
      source: "gwada",
      externalId: null,
      externalVersion: null,
      externalEditUrl: null,
      voucherNumber: null,
      status,
    };
  },
};
