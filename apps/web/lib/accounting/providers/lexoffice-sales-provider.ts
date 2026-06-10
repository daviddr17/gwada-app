import type { AccountingSalesDocumentProvider, CreateSalesDocumentResult } from "@/lib/accounting/providers/types";
import { createLexofficeInvoice, createLexofficeQuotation } from "@/lib/integrations/lexoffice-sales-documents";
import type { AccountingSalesDocumentInput } from "@/lib/types/accounting";

export const lexofficeAccountingProvider: AccountingSalesDocumentProvider = {
  key: "lexoffice",
  async createInvoice(
    restaurantId: string,
    input: AccountingSalesDocumentInput,
  ): Promise<CreateSalesDocumentResult> {
    const created = await createLexofficeInvoice(restaurantId, input);
    return {
      source: "lexoffice",
      externalId: created.id,
      externalVersion: created.version,
      externalEditUrl: created.editUrl,
      voucherNumber: created.voucherNumber,
      status: created.voucherStatus,
    };
  },
  async createQuotation(
    restaurantId: string,
    input: AccountingSalesDocumentInput,
  ): Promise<CreateSalesDocumentResult> {
    const created = await createLexofficeQuotation(restaurantId, input);
    return {
      source: "lexoffice",
      externalId: created.id,
      externalVersion: created.version,
      externalEditUrl: created.editUrl,
      voucherNumber: created.voucherNumber,
      status: created.voucherStatus,
    };
  },
};
