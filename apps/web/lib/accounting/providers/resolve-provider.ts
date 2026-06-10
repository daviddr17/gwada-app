import { gwadaAccountingProvider } from "@/lib/accounting/providers/gwada-provider";
import { lexofficeAccountingProvider } from "@/lib/accounting/providers/lexoffice-sales-provider";
import type { AccountingSalesDocumentProvider } from "@/lib/accounting/providers/types";

export function resolveAccountingSalesProvider(
  syncToLexoffice: boolean,
): AccountingSalesDocumentProvider {
  return syncToLexoffice ? lexofficeAccountingProvider : gwadaAccountingProvider;
}
